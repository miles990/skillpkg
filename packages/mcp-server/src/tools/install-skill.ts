/**
 * Tool: install_skill
 *
 * Installs a skill from GitHub, Gist, URL, or local path.
 * Supports SKILL.md format (industry standard for Claude Code and OpenAI Codex).
 */

import type { ToolHandler, ToolResult, InstallSkillInput, InstallSkillOutput, SourceType } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import { InvalidSourceError } from '../types.js';
import { parse as parseSkillYaml, detectSkillMd, fetchSkillMdContent } from 'skillpkg-core';

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

  // Simple skill names are no longer supported (no central registry)
  // Suggest using github:owner/repo format instead
  throw new InvalidSourceError(
    `Invalid source "${source}". Use one of: github:owner/repo, gist:id, https://url, or ./local/path`
  );
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
 * Fetch skill from GitHub repo (SKILL.md or skill.yaml)
 * Uses shared logic from skillpkg-core
 */
async function fetchSkillFromGitHub(repo: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN;

  // Try SKILL.md first using core's detection
  const detection = await detectSkillMd(repo, token);

  if (detection.hasSkill && detection.skillFile) {
    const content = await fetchSkillMdContent(repo, detection.skillFile, token);
    if (content) {
      // Convert to skill.yaml format for compatibility
      return `schema: "1.0"\nname: ${content.name}\nversion: ${content.version}\ndescription: ${JSON.stringify(content.description)}\ninstructions: |\n${content.instructions.split('\n').map((l) => '  ' + l).join('\n')}`;
    }
  }

  // Fall back to skill.yaml
  const skillYamlPaths = ['skill.yaml', 'skill.yml', '.claude/skill.yaml'];
  const branches = ['main', 'master', 'HEAD'];

  for (const branch of branches) {
    for (const path of skillYamlPaths) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
      try {
        const yamlContent = await fetchSkillFromUrl(url);
        return yamlContent;
      } catch {
        // Try next path/branch
      }
    }
  }

  throw new Error(`Could not find SKILL.md or skill.yaml in repository ${repo}`);
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
    description: `Install a skill from various sources. Supports SKILL.md format (industry standard for Claude Code and OpenAI Codex).

Supported source formats:
• GitHub: github:user/repo or user/repo (e.g., "anthropics/claude-code-skills")
• Gist: gist:id (e.g., "gist:abc123")
• URL: https://... (direct link to SKILL.md or skill.yaml)
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
          source: type === 'local' ? 'local' : 'import',
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
