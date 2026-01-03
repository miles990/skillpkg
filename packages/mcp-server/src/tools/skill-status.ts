/**
 * Tool: skill_status
 *
 * Shows overall project status including skills, MCP servers, and sync status.
 * Useful for AI agents to understand the current project state.
 */

import type { ToolHandler, ToolResult } from '../types.js';
import { successResult, errorResult } from './utils.js';
import {
  createStateManager,
  createConfigManager,
  getImplementedTargets,
} from 'skillpkg-core';

export interface SkillStatusOutput {
  project: {
    name: string | null;
    configExists: boolean;
  };
  skills: {
    total: number;
    userInstalled: number;
    transitive: number;
    list: Array<{
      name: string;
      version: string;
      installedBy: string;
    }>;
  };
  mcp: {
    configured: number;
    list: Array<{
      name: string;
      command: string;
    }>;
  };
  sync: {
    targetsEnabled: string[];
    lastSync: Record<string, string | null>;
  };
}

export function createSkillStatusHandler(): ToolHandler {
  return {
    name: 'skill_status',
    description: `Show overall project status including skills, MCP servers, and sync status.

Returns a comprehensive view of:
- Project configuration status
- Installed skills (direct and transitive)
- Configured MCP servers
- Sync targets and last sync times

Useful for understanding the current state before making changes.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },

    async execute(): Promise<ToolResult> {
      try {
        const cwd = process.cwd();
        const stateManager = createStateManager();
        const configManager = createConfigManager();

        // Load state and config
        const state = await stateManager.loadState(cwd);
        const config = await configManager.loadProjectConfig(cwd);

        // Build status output
        const output: SkillStatusOutput = {
          project: {
            name: config?.name || null,
            configExists: config !== null,
          },
          skills: {
            total: 0,
            userInstalled: 0,
            transitive: 0,
            list: [],
          },
          mcp: {
            configured: 0,
            list: [],
          },
          sync: {
            targetsEnabled: [],
            lastSync: {},
          },
        };

        // Skills info
        for (const [name, skillState] of Object.entries(state.skills)) {
          output.skills.total++;
          if (skillState.installed_by === 'user') {
            output.skills.userInstalled++;
          } else {
            output.skills.transitive++;
          }
          output.skills.list.push({
            name,
            version: skillState.version,
            installedBy: skillState.installed_by,
          });
        }

        // MCP info
        if (config?.mcp) {
          for (const [name, mcpConfig] of Object.entries(config.mcp)) {
            output.mcp.configured++;
            output.mcp.list.push({
              name,
              command: mcpConfig.command || mcpConfig.package || '',
            });
          }
        }

        // Sync info
        if (config?.sync_targets) {
          output.sync.targetsEnabled = Object.entries(config.sync_targets)
            .filter(([_, enabled]) => enabled)
            .map(([name]) => name);
        }

        // Get sync history from state
        if (state.sync_history) {
          for (const [target, timestamp] of Object.entries(state.sync_history)) {
            output.sync.lastSync[target] = timestamp
              ? new Date(timestamp).toLocaleString()
              : null;
          }
        }

        // Format human-readable output
        const lines: string[] = [];

        // Project section
        lines.push('📦 Project');
        if (config) {
          lines.push(`   Name: ${config.name}`);
          lines.push('   Config: skillpkg.json ✓');
        } else {
          lines.push('   Config: No skillpkg.json');
          lines.push('   → Run `skillpkg init` to create one');
        }
        lines.push('');

        // Skills section
        lines.push('🔧 Skills');
        if (output.skills.total === 0) {
          lines.push('   No skills installed');
          lines.push('   → Use install_skill to add skills');
        } else {
          lines.push(
            `   Total: ${output.skills.total} (${output.skills.userInstalled} direct, ${output.skills.transitive} transitive)`
          );

          const userSkills = output.skills.list.filter((s) => s.installedBy === 'user');
          const transitiveSkills = output.skills.list.filter((s) => s.installedBy !== 'user');

          if (userSkills.length > 0) {
            lines.push('   Direct:');
            for (const skill of userSkills) {
              lines.push(`     • ${skill.name} v${skill.version}`);
            }
          }

          if (transitiveSkills.length > 0) {
            lines.push('   Transitive:');
            for (const skill of transitiveSkills) {
              lines.push(`     • ${skill.name} v${skill.version} (via ${skill.installedBy})`);
            }
          }
        }
        lines.push('');

        // MCP section
        lines.push('🔌 MCP Servers');
        if (output.mcp.configured === 0) {
          lines.push('   No MCP servers configured');
        } else {
          lines.push(`   Configured: ${output.mcp.configured}`);
          for (const mcp of output.mcp.list) {
            lines.push(`     • ${mcp.name}: ${mcp.command}`);
          }
        }
        lines.push('');

        // Sync section
        lines.push('🔄 Sync Targets');
        const implementedTargets = getImplementedTargets();
        const implementedIds = implementedTargets.map((t) => t.id);

        if (output.sync.targetsEnabled.length === 0) {
          lines.push('   No sync targets enabled');
        } else {
          for (const target of output.sync.targetsEnabled) {
            const isImplemented = implementedIds.includes(target as any);
            const lastSync = output.sync.lastSync[target];
            let status: string;

            if (!isImplemented) {
              status = '(not implemented)';
            } else if (lastSync) {
              status = `✓ synced ${lastSync}`;
            } else {
              status = '⚠ not synced';
            }

            lines.push(`   • ${target}: ${status}`);
          }
        }
        lines.push('');

        // Suggestions
        lines.push('💡 Suggestions');
        if (output.skills.total === 0) {
          lines.push('   • Use search_skills to find skills');
          lines.push('   • Use install_skill to install');
        } else {
          const needsSync = output.sync.targetsEnabled.some(
            (t) => implementedIds.includes(t as any) && !output.sync.lastSync[t]
          );
          if (needsSync) {
            lines.push('   • Use sync_skills to sync to platforms');
          }
          lines.push('   • Use load_skill to view skill instructions');
        }

        return successResult(lines.join('\n'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to get status: ${message}`);
      }
    },
  };
}
