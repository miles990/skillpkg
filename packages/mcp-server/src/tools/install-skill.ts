/**
 * Tool: install_skill
 *
 * Installs a skill from GitHub, Gist, URL, or local path.
 * Supports SKILL.md format (industry standard for Claude Code and OpenAI Codex).
 */

import type { ToolHandler, ToolResult, InstallSkillInput, InstallSkillOutput, SourceType } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import { InvalidSourceError } from '../types.js';
import { parse as parseSkillYaml } from 'skillpkg-core';
import { parse as parseYaml } from 'yaml';

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
 * Parse SKILL.md frontmatter (YAML between --- markers)
 */
interface SkillMdFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  'allowed-tools'?: string;
  metadata?: {
    'short-description'?: string;
  };
}

function parseSkillMdFrontmatter(
  content: string
): { frontmatter: SkillMdFrontmatter; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  try {
    const frontmatter = parseYaml(match[1]) as SkillMdFrontmatter;
    return { frontmatter, body: match[2] };
  } catch {
    return null;
  }
}

/**
 * Fetch skill from GitHub repo (SKILL.md or skill.yaml)
 */
async function fetchSkillFromGitHub(repo: string): Promise<string> {
  // Try SKILL.md first (industry standard), then fall back to skill.yaml
  const skillMdPaths = [
    'SKILL.md',
    'skill.md',
    'skills/SKILL.md',
    'skills/skill.md',
    '.claude/skills/skill.md',
  ];
  const skillYamlPaths = ['skill.yaml', 'skill.yml', '.claude/skill.yaml'];
  const branches = ['main', 'master', 'HEAD'];

  // Try SKILL.md first
  for (const branch of branches) {
    for (const path of skillMdPaths) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
      try {
        const content = await fetchSkillFromUrl(url);
        const parsed = parseSkillMdFrontmatter(content);
        if (parsed && parsed.frontmatter.name) {
          // Convert SKILL.md to skill.yaml format for compatibility
          const skillYaml = {
            schema: '1.0',
            name: parsed.frontmatter.name,
            version: parsed.frontmatter.version || '1.0.0',
            description:
              parsed.frontmatter.description ||
              parsed.frontmatter.metadata?.['short-description'] ||
              '',
            instructions: parsed.body,
          };
          return `schema: "1.0"\nname: ${skillYaml.name}\nversion: ${skillYaml.version}\ndescription: ${JSON.stringify(skillYaml.description)}\ninstructions: |\n${parsed.body.split('\n').map((l) => '  ' + l).join('\n')}`;
        }
      } catch {
        // Try next path/branch
      }
    }
  }

  // Fall back to skill.yaml
  for (const branch of branches) {
    for (const path of skillYamlPaths) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
      try {
        const content = await fetchSkillFromUrl(url);
        return content;
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
