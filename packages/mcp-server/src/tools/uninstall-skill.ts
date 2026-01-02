/**
 * Tool: uninstall_skill
 *
 * v2.0: Uses new Installer module with dependency checking.
 * Returns dependency warnings and supports force uninstall.
 */

import type { ToolHandler, ToolResult, UninstallSkillInput } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  type SkillFetcherAdapter,
} from 'skillpkg-core';

/**
 * Create a minimal fetcher adapter (not used for uninstall but required by Installer)
 */
function createMinimalFetcher(): SkillFetcherAdapter {
  return {
    async fetchMetadata() {
      return null;
    },
    async fetchSkill() {
      return null;
    },
  };
}

export function createUninstallSkillHandler(): ToolHandler {
  return {
    name: 'uninstall_skill',
    description: `Uninstall a skill by name. Checks for dependencies before removal.

If other skills depend on this skill, uninstall will fail unless force=true.
Use the 'why' command to see what depends on a skill.

Returns:
• Success message with removed skill info
• Warning if skill had dependents (with force=true)
• Error if skill has dependents (without force)`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Name of the skill to uninstall',
        },
        scope: {
          type: 'string',
          enum: ['local', 'global'],
          default: 'local',
          description: 'Scope to uninstall from: local (project) or global (~/.skillpkg)',
        },
        force: {
          type: 'boolean',
          default: false,
          description: 'Force uninstall even if other skills depend on this one',
        },
      },
      required: ['id'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as UninstallSkillInput & { force?: boolean };

      try {
        const skillName = validateString(input.id, 'id');
        const scope = validateScope(input.scope, 'local');
        const force = input.force ?? false;

        // Get project path (cwd for MCP server context)
        const cwd = process.cwd();

        // Create installer
        const stateManager = createStateManager();
        const configManager = createConfigManager();
        const storeManager = getStore(scope);
        const fetcher = createMinimalFetcher();

        // Check if store is initialized
        if (!(await storeManager.isInitialized())) {
          return errorResult(
            `No skills installed in ${scope} scope.`,
            'Use list_skills to see installed skills.'
          );
        }

        // Check if skill exists
        const exists = await storeManager.hasSkill(skillName);
        if (!exists) {
          return errorResult(
            `Skill "${skillName}" is not installed in ${scope} scope.`,
            'Use list_skills to see installed skills.'
          );
        }

        const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

        // Check for dependents (unless force)
        if (!force) {
          const check = await installer.canUninstall(cwd, skillName);
          if (!check.canUninstall) {
            const dependentsList = check.dependents.join(', ');
            return errorResult(
              `Cannot uninstall "${skillName}" - other skills depend on it:\n   ${dependentsList}`,
              `Use force=true to uninstall anyway, or uninstall the dependent skills first.`
            );
          }
        }

        // Perform uninstall
        const result = await installer.uninstall(cwd, skillName, {
          force,
          removeOrphans: true,
        });

        if (!result.success) {
          const errors = result.errors.join('; ');
          return errorResult(`Uninstall failed: ${errors}`);
        }

        // Build response
        const lines: string[] = [];

        // Main skill removed
        if (result.removed.includes(skillName)) {
          lines.push(`✅ Uninstalled "${skillName}" from ${scope} scope.`);
        }

        // Orphan dependencies removed
        if (result.orphansRemoved.length > 0) {
          lines.push('');
          lines.push(`🧹 Cleaned up ${result.orphansRemoved.length} orphan dependencies:`);
          for (const orphan of result.orphansRemoved) {
            lines.push(`   • ${orphan}`);
          }
        }

        // Force warning (check if we had dependents before)
        if (force) {
          // Can't determine from result if there were dependents, but force was used
          lines.push('');
          lines.push('⚠️  Note: Force uninstall was used. Check that dependent skills still work.');
        }

        // Next steps
        lines.push('');
        lines.push('📋 Next steps:');
        lines.push('   • Run `skillpkg sync` to update platform directories');

        return successResult(lines.join('\n'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to uninstall skill: ${message}`);
      }
    },
  };
}
