/**
 * Tool: sync_skills
 *
 * v2.0: Syncs installed skills to AI platform directories.
 * Supports multiple targets with incremental sync.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { ToolHandler, ToolResult } from '../types.js';
import { getStore, successResult, errorResult, validateScope } from './utils.js';
import {
  createSyncer,
  getImplementedTargets,
  getTargetConfig,
  type SyncTarget,
  type SkillContent,
  type FileSyncResult,
} from 'skillpkg-core';

interface SyncSkillsInput {
  scope?: 'local' | 'global';
  target?: string;
  dryRun?: boolean;
  essentialOnly?: boolean;
}

/**
 * Load skills from store and convert to SkillContent map
 */
async function loadSkillsFromStore(
  storeDir: string,
  skillNames: string[]
): Promise<Map<string, SkillContent>> {
  const skills = new Map<string, SkillContent>();
  const skillsDir = join(storeDir, 'skills');

  for (const name of skillNames) {
    const skillMdPath = join(skillsDir, name, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      continue;
    }

    try {
      const rawContent = await readFile(skillMdPath, 'utf-8');
      const { data, content: body } = matter(rawContent);

      skills.set(name, {
        name: (data.name as string) || name,
        version: (data.version as string) || '1.0.0',
        rawContent,
        bodyContent: body.trim(),
        frontmatter: data,
      });
    } catch {
      // Skip invalid skills
    }
  }

  return skills;
}

export function createSyncSkillsHandler(): ToolHandler {
  return {
    name: 'sync_skills',
    description: `Sync installed skills to AI platform directories.

Syncs skills from the skillpkg store to platform-specific directories:
• claude-code → .claude/skills/
• cursor → .cursor/skills/
• codex → .codex/skills/
• copilot → .github/copilot/skills/
• windsurf → .windsurf/skills/

Currently implemented: claude-code (others reserved for future)

Returns:
• List of synced skills with status (created/updated/unchanged)
• Summary of changes made
• Any errors encountered`,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['local', 'global'],
          default: 'local',
          description: 'Scope to sync from: local (project) or global (~/.skillpkg)',
        },
        target: {
          type: 'string',
          description:
            'Target platform to sync to (default: all implemented targets). Options: claude-code',
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'Preview sync without making changes',
        },
        essentialOnly: {
          type: 'boolean',
          default: false,
          description: 'Sync only SKILL.md without additional files (scripts, references)',
        },
      },
      required: [],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as SyncSkillsInput;

      try {
        const scope = validateScope(input.scope, 'local');
        const dryRun = input.dryRun ?? false;

        // Get project path
        const cwd = process.cwd();

        // Get store
        const store = getStore(scope);

        // Check if store is initialized
        if (!(await store.isInitialized())) {
          return errorResult(
            `No skills installed in ${scope} scope.`,
            'Install skills first using install_skill.'
          );
        }

        // Get skill names from store
        const skillNames = await store.getSkillNames();
        if (skillNames.length === 0) {
          return errorResult('No skills to sync.', 'Install skills first using install_skill.');
        }

        // Load skills from store as SkillContent
        const storeDir = store.getStoreDir();
        const skills = await loadSkillsFromStore(storeDir, skillNames);

        if (skills.size === 0) {
          return errorResult('No valid skills to sync.', 'Check skill files in the store.');
        }

        // Determine targets
        const implementedTargets = getImplementedTargets();
        const implementedIds = implementedTargets.map((t) => t.id);

        let targetIds: SyncTarget[];
        if (input.target) {
          // Validate target
          if (!implementedIds.includes(input.target as SyncTarget)) {
            return errorResult(
              `Target "${input.target}" is not implemented.`,
              `Available targets: ${implementedIds.join(', ')}`
            );
          }
          targetIds = [input.target as SyncTarget];
        } else {
          // All implemented targets
          targetIds = implementedIds;
        }

        // Create syncer
        const syncer = createSyncer();

        // Sync to each target
        const lines: string[] = [];
        let totalCreated = 0;
        let totalUpdated = 0;
        let totalUnchanged = 0;

        if (dryRun) {
          lines.push('🔍 Dry run mode - no changes will be made');
          lines.push('');
        }

        for (const targetId of targetIds) {
          const targetConfig = getTargetConfig(targetId);
          lines.push(`📁 Target: ${targetConfig.displayName} (${targetConfig.outputPath})`);

          const result = await syncer.syncToTarget(cwd, skills, targetConfig, {
            dryRun,
            essentialOnly: input.essentialOnly,
          });

          if (!result.success) {
            lines.push(`   ❌ Error: ${result.errors.join(', ')}`);
            continue;
          }

          // Count results from files array
          const created = result.files.filter((f: FileSyncResult) => f.action === 'created').length;
          const updated = result.files.filter((f: FileSyncResult) => f.action === 'updated').length;
          const unchanged = result.files.filter(
            (f: FileSyncResult) => f.action === 'unchanged'
          ).length;

          totalCreated += created;
          totalUpdated += updated;
          totalUnchanged += unchanged;

          if (created > 0 || updated > 0) {
            lines.push(`   ✅ ${created} created, ${updated} updated, ${unchanged} unchanged`);
          } else if (unchanged > 0) {
            lines.push(`   ⏭️  All ${unchanged} skills already up to date`);
          }

          // Show details for created/updated
          for (const file of result.files) {
            if (file.action === 'created') {
              lines.push(`      + ${file.skillName || file.path}`);
            } else if (file.action === 'updated') {
              lines.push(`      ~ ${file.skillName || file.path}`);
            }
          }
        }

        // Summary
        lines.push('');
        if (dryRun) {
          lines.push(
            `📊 Would sync: ${totalCreated} create, ${totalUpdated} update, ${totalUnchanged} unchanged`
          );
        } else {
          lines.push(
            `📊 Synced: ${totalCreated} created, ${totalUpdated} updated, ${totalUnchanged} unchanged`
          );
        }

        return successResult(lines.join('\n'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to sync skills: ${message}`);
      }
    },
  };
}
