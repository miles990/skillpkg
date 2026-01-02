/**
 * Tool: uninstall_skill
 *
 * Removes an installed skill.
 */

import type { ToolHandler, ToolResult, UninstallSkillInput, UninstallSkillOutput } from '../types.js';
import { getStore, successResult, errorResult, validateString, validateScope } from './utils.js';

export function createUninstallSkillHandler(): ToolHandler {
  return {
    name: 'uninstall_skill',
    description: 'Uninstall a skill by name. Removes it from the specified scope.',
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
      },
      required: ['id'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as UninstallSkillInput;

      try {
        const skillName = validateString(input.id, 'id');
        const scope = validateScope(input.scope, 'local');

        const store = getStore(scope);

        // Check if store is initialized
        if (!(await store.isInitialized())) {
          return errorResult(
            `No skills installed in ${scope} scope.`,
            'Use list_skills to see installed skills.'
          );
        }

        // Check if skill exists
        const exists = await store.hasSkill(skillName);
        if (!exists) {
          return errorResult(
            `Skill "${skillName}" is not installed in ${scope} scope.`,
            'Use list_skills to see installed skills.'
          );
        }

        // Remove the skill
        const removed = await store.removeSkill(skillName);

        if (!removed) {
          return errorResult(`Failed to uninstall skill "${skillName}".`);
        }

        const output: UninstallSkillOutput = {
          success: true,
          message: `Successfully uninstalled "${skillName}" from ${scope} scope.`,
        };

        return successResult(output.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to uninstall skill: ${message}`);
      }
    },
  };
}
