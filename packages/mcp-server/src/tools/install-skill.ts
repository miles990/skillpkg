/**
 * Tool: install_skill
 *
 * v2.2: Auto-sync after install based on global config
 * Returns dependency info and MCP requirements.
 */

import { join } from 'path';
import type { ToolHandler, ToolResult, InstallSkillInput } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  createSkillFetcherAdapter,
  normalizeSource,
  InvalidSourceError,
  loadConfig,
  getGlobalDir,
  createSyncer,
  loadSkillsFromDirectory,
  getTargetConfig,
  getImplementedTargets,
  type SyncTarget,
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

        // Auto-sync if skills were installed/updated
        if (installed.length > 0 || updated.length > 0) {
          const syncResult = await autoSyncSkills(cwd, scope);
          if (syncResult.length > 0) {
            lines.push('');
            lines.push('🔄 Auto-synced to:');
            for (const msg of syncResult) {
              lines.push(`   ${msg}`);
            }
          }
        }

        // Next steps
        lines.push('');
        lines.push('📋 Next steps:');
        lines.push('   • Run `skillpkg tree` to see dependency tree');

        return successResult(lines.join('\n'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to install skill: ${message}`);
      }
    },
  };
}

/**
 * Auto-sync skills to configured targets after install
 */
async function autoSyncSkills(
  cwd: string,
  scope: 'local' | 'global'
): Promise<string[]> {
  const messages: string[] = [];

  try {
    // Load global config to get auto-sync targets
    const globalDir = getGlobalDir();
    const globalConfig = await loadConfig(globalDir);

    // Get enabled auto-sync targets
    const enabledTargets = Object.entries(globalConfig.autoSyncTargets)
      .filter(([_, enabled]) => enabled)
      .map(([target]) => target);

    if (enabledTargets.length === 0) {
      return messages; // No auto-sync targets configured
    }

    // Get implemented targets
    const implementedTargets = getImplementedTargets();
    const implementedIds = new Set(implementedTargets.map((t) => t.id));

    // Filter to only implemented targets
    const validTargets = enabledTargets.filter((t) => implementedIds.has(t as SyncTarget));

    if (validTargets.length === 0) {
      return messages;
    }

    // Load skills from store
    const storeDir = scope === 'global' ? globalDir : join(cwd, '.skillpkg');
    const skillsDir = join(storeDir, 'skills');
    const skills = await loadSkillsFromDirectory(skillsDir);

    if (skills.size === 0) {
      return messages;
    }

    // Create syncer and sync to each target
    const syncer = createSyncer();

    for (const targetId of validTargets) {
      const targetConfig = getTargetConfig(targetId as SyncTarget);

      const result = await syncer.syncToTarget(cwd, skills, targetConfig, { dryRun: false });

      if (result.success) {
        const synced = result.files.filter((f) => f.action === 'created' || f.action === 'updated');
        if (synced.length > 0) {
          messages.push(`✅ ${targetConfig.displayName}: ${synced.length} skill(s) synced`);
        } else {
          messages.push(`⏭️  ${targetConfig.displayName}: already up to date`);
        }
      } else {
        messages.push(`⚠️  ${targetConfig.displayName}: ${result.errors.join(', ')}`);
      }
    }
  } catch {
    // Silently ignore sync errors - don't fail the install
  }

  return messages;
}
