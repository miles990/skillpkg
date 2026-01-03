/**
 * Tool: install_skill
 *
 * v2.1: Uses unified fetcher from skillpkg-core
 * Returns dependency info and MCP requirements.
 */

import type { ToolHandler, ToolResult, InstallSkillInput } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  createSkillFetcherAdapter,
  normalizeSource,
  InvalidSourceError,
} from 'skillpkg-core';

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

        // Normalize source using unified parser
        let normalizedSource: string;
        try {
          normalizedSource = normalizeSource(sourceStr);
        } catch (error) {
          if (error instanceof InvalidSourceError) {
            return errorResult(error.message);
          }
          throw error;
        }

        // Get project path (cwd for MCP server context)
        const cwd = process.cwd();

        // Create installer with unified fetcher
        const stateManager = createStateManager();
        const configManager = createConfigManager();
        const storeManager = getStore(scope);
        const fetcher = createSkillFetcherAdapter();

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
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to install skill: ${message}`);
      }
    },
  };
}
