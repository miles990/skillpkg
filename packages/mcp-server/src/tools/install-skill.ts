/**
 * Tool: install_skill
 *
 * Installs a skill from registry, GitHub, Gist, URL, or local path.
 */

import type { ToolHandler, ToolResult, InstallSkillInput, InstallSkillOutput, SourceType } from '../types.js';
import { getStore, getRegistryClient, successResult, errorResult, validateString, validateScope } from './utils.js';
import { InvalidSourceError } from '../types.js';
import { parse as parseSkillYaml } from 'skillpkg-core';

/**
 * Parse source string to determine source type
 */
function parseSource(source: string): { type: SourceType; value: string } {
  // GitHub: github:user/repo or user/repo
  if (source.startsWith('github:')) {
    return { type: 'github', value: source.slice(7) };
  }
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source)) {
    return { type: 'github', value: source };
  }

  // Gist: gist:id
  if (source.startsWith('gist:')) {
    return { type: 'gist', value: source.slice(5) };
  }

  // URL: https:// or http://
  if (source.startsWith('https://') || source.startsWith('http://')) {
    return { type: 'url', value: source };
  }

  // Local path: starts with ./ or / or contains path separators
  if (source.startsWith('./') || source.startsWith('/') || source.startsWith('../')) {
    return { type: 'local', value: source };
  }

  // Registry: skill name (alphanumeric with hyphens)
  if (/^[a-z][a-z0-9-]*$/.test(source)) {
    return { type: 'registry', value: source };
  }

  throw new InvalidSourceError(source);
}

/**
 * Fetch skill content from URL
 */
async function fetchSkillFromUrl(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * Fetch skill from GitHub repo (raw skill.yaml)
 */
async function fetchSkillFromGitHub(repo: string): Promise<string> {
  // Try common locations for skill.yaml
  const paths = ['skill.yaml', 'skill.yml', '.claude/skill.yaml'];
  const branches = ['main', 'master'];

  for (const branch of branches) {
    for (const path of paths) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
      try {
        const content = await fetchSkillFromUrl(url);
        return content;
      } catch {
        // Try next path/branch
      }
    }
  }

  throw new Error(`Could not find skill.yaml in repository ${repo}`);
}

/**
 * Fetch skill from Gist
 */
async function fetchSkillFromGist(gistId: string): Promise<string> {
  const apiUrl = `https://api.github.com/gists/${gistId}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch gist ${gistId}: ${response.status}`);
  }

  const gist = (await response.json()) as {
    files: Record<string, { content: string; filename: string }>;
  };

  // Look for skill.yaml or skill.yml
  for (const [filename, file] of Object.entries(gist.files)) {
    if (filename === 'skill.yaml' || filename === 'skill.yml') {
      return file.content;
    }
  }

  throw new Error(`No skill.yaml found in gist ${gistId}`);
}

/**
 * Fetch skill from local path
 */
async function fetchSkillFromLocal(path: string): Promise<string> {
  const fs = await import('fs/promises');
  const nodePath = await import('path');

  let skillPath = path;
  const stat = await fs.stat(path);

  if (stat.isDirectory()) {
    // Look for skill.yaml in directory
    const candidates = ['skill.yaml', 'skill.yml'];
    for (const candidate of candidates) {
      const fullPath = nodePath.join(path, candidate);
      try {
        await fs.access(fullPath);
        skillPath = fullPath;
        break;
      } catch {
        // Try next
      }
    }
  }

  return fs.readFile(skillPath, 'utf-8');
}

export function createInstallSkillHandler(): ToolHandler {
  return {
    name: 'install_skill',
    description: `Install a skill from various sources.

Supported source formats:
• Registry: skill-name (e.g., "commit-helper")
• GitHub: github:user/repo or user/repo (e.g., "anthropics/claude-code-skills")
• Gist: gist:id (e.g., "gist:abc123")
• URL: https://... (direct link to skill.yaml)
• Local: ./path or /absolute/path (local file or directory)`,
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source to install from: skill-name, github:user/repo, gist:id, URL, or local path',
        },
        scope: {
          type: 'string',
          enum: ['local', 'global'],
          default: 'local',
          description: 'Where to install: local (project) or global (~/.skillpkg)',
        },
      },
      required: ['source'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as InstallSkillInput;

      try {
        const sourceStr = validateString(input.source, 'source');
        const scope = validateScope(input.scope, 'local');

        // Parse the source
        const { type, value } = parseSource(sourceStr);

        // Fetch skill content based on source type
        let skillContent: string;

        switch (type) {
          case 'registry': {
            // Download from registry
            const client = getRegistryClient();
            const info = await client.getSkillInfo(value);
            // For now, fetch the skill.yaml URL if available
            // In future, download tarball and extract
            if (info.repository) {
              skillContent = await fetchSkillFromGitHub(info.repository.replace('https://github.com/', ''));
            } else {
              throw new Error(`Registry skill "${value}" does not have a repository URL`);
            }
            break;
          }

          case 'github':
            skillContent = await fetchSkillFromGitHub(value);
            break;

          case 'gist':
            skillContent = await fetchSkillFromGist(value);
            break;

          case 'url':
            skillContent = await fetchSkillFromUrl(value);
            break;

          case 'local':
            skillContent = await fetchSkillFromLocal(value);
            break;
        }

        // Parse the skill content
        const parseResult = parseSkillYaml(skillContent);
        if (!parseResult.success || !parseResult.data) {
          const errors = parseResult.errors?.map((e) => e.message).join(', ') || 'Unknown parse error';
          return errorResult(`Invalid skill.yaml: ${errors}`);
        }

        const skill = parseResult.data;

        // Get the store and initialize if needed
        const store = getStore(scope);
        if (!(await store.isInitialized())) {
          await store.init();
        }

        // Check if already installed
        if (await store.hasSkill(skill.name)) {
          // Update instead of error
          await store.updateSkill(skill.name, skill);

          const output: InstallSkillOutput = {
            success: true,
            skill: {
              id: `${scope}:${skill.name}`,
              name: skill.name,
              version: skill.version,
              source: sourceStr,
              installedAt: new Date().toISOString(),
            },
            message: `Updated "${skill.name}" to v${skill.version} in ${scope} scope.`,
          };

          return successResult(output.message);
        }

        // Add the skill
        await store.addSkill(skill, {
          source: type === 'local' ? 'local' : type === 'registry' ? 'registry' : 'import',
          sourceUrl: sourceStr,
        });

        const output: InstallSkillOutput = {
          success: true,
          skill: {
            id: `${scope}:${skill.name}`,
            name: skill.name,
            version: skill.version,
            source: sourceStr,
            installedAt: new Date().toISOString(),
          },
          message: `Successfully installed "${skill.name}" v${skill.version} to ${scope} scope.`,
        };

        return successResult(output.message);
      } catch (error) {
        if (error instanceof InvalidSourceError) {
          return errorResult(error.message);
        }
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to install skill: ${message}`);
      }
    },
  };
}
