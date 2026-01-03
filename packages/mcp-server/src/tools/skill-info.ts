/**
 * Tool: skill_info
 *
 * Gets detailed information about an installed skill.
 */

import type { ToolHandler, ToolResult } from '../types.js';
import { successResult, errorResult, validateString } from './utils.js';
import { createGlobalStore, createLocalStore, getSkillMdPath } from 'skillpkg-core';

export interface SkillInfoInput {
  name: string;
}

export function createSkillInfoHandler(): ToolHandler {
  return {
    name: 'skill_info',
    description: `Get detailed information about an installed skill.

Shows skill metadata, installation details, and instructions preview.
Searches both local (.skillpkg) and global (~/.skillpkg) stores.

Parameters:
- name (required): Name of the installed skill

Returns skill details including version, description, path, and sync status.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the skill to get information about',
        },
      },
      required: ['name'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as SkillInfoInput;

      try {
        const skillName = validateString(input.name, 'name');

        // Try local first, then global
        const stores = [createLocalStore(), createGlobalStore()];

        for (const store of stores) {
          const skill = await store.getSkill(skillName);
          if (!skill) continue;

          const entry = await store.getSkillEntry(skillName);
          const storeDir = store.getStoreDir();
          const skillPath = getSkillMdPath(storeDir, skillName);
          const scope = storeDir.includes('.skillpkg') && !storeDir.includes('/.skillpkg')
            ? 'global'
            : 'local';

          // Format output
          const lines: string[] = [
            `# ${skill.name} (${scope})`,
            '',
            `**Version:** ${skill.version}`,
          ];

          if (skill.description) {
            lines.push(`**Description:** ${skill.description}`);
          }

          if (skill.author) {
            const author = typeof skill.author === 'string'
              ? skill.author
              : skill.author.name;
            lines.push(`**Author:** ${author}`);
          }

          lines.push('');
          lines.push(`**Path:** ${skillPath}`);

          if (entry?.source) {
            lines.push(`**Source:** ${entry.source}`);
          }

          if (entry?.sourceUrl) {
            lines.push(`**Source URL:** ${entry.sourceUrl}`);
          }

          if (entry?.installedAt) {
            const date = new Date(entry.installedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            lines.push(`**Installed:** ${date}`);
          }

          if (entry?.syncedPlatforms && entry.syncedPlatforms.length > 0) {
            lines.push(`**Synced to:** ${entry.syncedPlatforms.join(', ')}`);
          }

          // Instructions preview
          if (skill.instructions) {
            lines.push('');
            lines.push('---');
            lines.push('');
            lines.push('**Instructions preview:**');
            const preview = skill.instructions.substring(0, 300);
            lines.push(preview + (skill.instructions.length > 300 ? '...' : ''));
          }

          lines.push('');
          lines.push('---');
          lines.push('');
          lines.push(`To uninstall: \`uninstall_skill id: "${skillName}"\``);
          lines.push(`To sync: \`sync_skills\``);

          return successResult(lines.join('\n'));
        }

        // Not found
        return errorResult(
          `Skill "${skillName}" is not installed.`,
          'Use search_skills to find available skills, or install_skill to install one.'
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to get skill info: ${message}`);
      }
    },
  };
}
