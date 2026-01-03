/**
 * Tool: install_skill
 *
 * v2.0: Uses new Installer module with dependency resolution.
 * Returns dependency info and MCP requirements.
 */

import type { ToolHandler, ToolResult, InstallSkillInput } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import { InvalidSourceError } from '../types.js';
import matter from 'gray-matter';
import {
  detectSkillMd,
  fetchSkillMdContent,
  createInstaller,
  createStateManager,
  createConfigManager,
  type Skill,
  type SkillFetcherAdapter,
} from 'skillpkg-core';

/**
 * Parse source string to determine source type
 */
type SourceType = 'github' | 'gist' | 'url' | 'local';

function parseSource(source: string): { type: SourceType; value: string } {
  if (source.startsWith('github:')) {
    return { type: 'github', value: source.slice(7) };
  }
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source)) {
    return { type: 'github', value: source };
  }
  if (source.startsWith('gist:')) {
    return { type: 'gist', value: source.slice(5) };
  }
  if (source.startsWith('https://') || source.startsWith('http://')) {
    return { type: 'url', value: source };
  }
  if (source.startsWith('./') || source.startsWith('/') || source.startsWith('../')) {
    return { type: 'local', value: source };
  }

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
 * Fetch skill from GitHub repo
 */
async function fetchSkillFromGitHub(repo: string): Promise<Skill | null> {
  const token = process.env.GITHUB_TOKEN;

  const detection = await detectSkillMd(repo, token);

  if (detection.hasSkill && detection.skillFile) {
    const content = await fetchSkillMdContent(repo, detection.skillFile, token);
    if (content) {
      return {
        schema: '1.0',
        name: content.name,
        version: content.version,
        description: content.description,
        instructions: content.instructions,
      };
    }
  }

  // No SKILL.md found in standard locations
  return null;
}

/**
 * Fetch skill from Gist
 */
async function fetchSkillFromGist(gistId: string): Promise<Skill | null> {
  const apiUrl = `https://api.github.com/gists/${gistId}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch gist ${gistId}: ${response.status}`);
  }

  const gist = (await response.json()) as {
    files: Record<string, { content: string; filename: string }>;
  };

  // Look for SKILL.md in Gist files
  for (const [filename, file] of Object.entries(gist.files)) {
    if (filename === 'SKILL.md' || filename === 'skill.md') {
      try {
        const { data, content: body } = matter(file.content);
        return {
          schema: '1.0',
          name: (data.name as string) || '',
          version: (data.version as string) || '1.0.0',
          description: (data.description as string) || '',
          instructions: body.trim(),
        };
      } catch {
        // Invalid frontmatter
      }
    }
  }

  return null;
}

/**
 * Fetch skill from local path
 */
async function fetchSkillFromLocal(path: string): Promise<Skill | null> {
  const fs = await import('fs/promises');
  const nodePath = await import('path');

  let skillPath = path;

  try {
    const stat = await fs.stat(path);

    if (stat.isDirectory()) {
      // Only SKILL.md format is supported
      const candidates = ['SKILL.md', 'skill.md'];
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

    // Only process SKILL.md files
    if (!skillPath.toLowerCase().endsWith('.md')) {
      return null;
    }

    const content = await fs.readFile(skillPath, 'utf-8');
    const { data, content: body } = matter(content);

    return {
      schema: '1.0',
      name: (data.name as string) || '',
      version: (data.version as string) || '1.0.0',
      description: (data.description as string) || '',
      instructions: body.trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Create a SkillFetcherAdapter
 */
function createFetcher(): SkillFetcherAdapter {
  return {
    async fetchMetadata(source: string) {
      const skill = await fetchSkillBySource(source);
      if (!skill) return null;
      return {
        name: skill.name,
        version: skill.version,
        dependencies: skill.dependencies,
      };
    },
    async fetchSkill(source: string) {
      return fetchSkillBySource(source);
    },
  };
}

async function fetchSkillBySource(source: string): Promise<Skill | null> {
  try {
    const { type, value } = parseSource(source);

    switch (type) {
      case 'github':
        return fetchSkillFromGitHub(value);
      case 'gist':
        return fetchSkillFromGist(value);
      case 'url': {
        const content = await fetchSkillFromUrl(value);
        // Parse as SKILL.md format with gray-matter
        try {
          const { data, content: body } = matter(content);
          return {
            schema: '1.0',
            name: (data.name as string) || '',
            version: (data.version as string) || '1.0.0',
            description: (data.description as string) || '',
            instructions: body.trim(),
          };
        } catch {
          return null;
        }
      }
      case 'local':
        return fetchSkillFromLocal(value);
    }
  } catch {
    return null;
  }
}

export function createInstallSkillHandler(): ToolHandler {
  return {
    name: 'install_skill',
    description: `Install a skill from various sources with dependency resolution.

Supports SKILL.md format (industry standard for Claude Code and OpenAI Codex).

Supported source formats:
• GitHub: github:user/repo or user/repo (e.g., "anthropics/claude-code-skills")
• Gist: gist:id (e.g., "gist:abc123")
• URL: https://... (direct link to SKILL.md)
• Local: ./path or /absolute/path (local file or directory)

Returns:
• List of installed skills (including dependencies)
• MCP servers required by the skill
• Suggestions for next steps`,
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source to install from: github:user/repo, gist:id, URL, or local path',
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

        // Normalize source
        const { type, value } = parseSource(sourceStr);
        const normalizedSource = type === 'github' ? `github:${value}` : sourceStr;

        // Get project path (cwd for MCP server context)
        const cwd = process.cwd();

        // Create installer
        const stateManager = createStateManager();
        const configManager = createConfigManager();
        const storeManager = getStore(scope);
        const fetcher = createFetcher();

        // Initialize store if needed
        if (!(await storeManager.isInitialized())) {
          await storeManager.init();
        }

        const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

        // Run installation
        const result = await installer.install(cwd, normalizedSource);

        if (!result.success) {
          const errors = result.errors.join('; ');
          return errorResult(`Installation failed: ${errors}`);
        }

        // Build response
        const installed = result.skills.filter((s) => s.action === 'installed');
        const updated = result.skills.filter((s) => s.action === 'updated');
        const skipped = result.skills.filter((s) => s.action === 'skipped');

        const lines: string[] = [];

        if (installed.length > 0) {
          lines.push(`✅ Installed ${installed.length} skill(s):`);
          for (const skill of installed) {
            const note = skill.transitive ? ` (dependency of ${skill.requiredBy})` : '';
            lines.push(`   • ${skill.name} v${skill.version}${note}`);
          }
        }

        if (updated.length > 0) {
          lines.push(`🔄 Updated ${updated.length} skill(s):`);
          for (const skill of updated) {
            lines.push(`   • ${skill.name} v${skill.version}`);
          }
        }

        if (skipped.length > 0) {
          lines.push(`⏭️  Skipped ${skipped.length} already installed skill(s)`);
        }

        // MCP requirements
        if (result.mcpRequired.length > 0) {
          lines.push('');
          lines.push('⚠️  MCP servers required:');
          for (const mcp of result.mcpRequired) {
            lines.push(`   • ${mcp}`);
          }
          lines.push('   Configure these in your skillpkg.json or install manually.');
        }

        // Next steps
        lines.push('');
        lines.push('📋 Next steps:');
        lines.push('   • Run `skillpkg sync` to sync to AI platforms');
        lines.push('   • Run `skillpkg tree` to see dependency tree');

        return successResult(lines.join('\n'));
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
