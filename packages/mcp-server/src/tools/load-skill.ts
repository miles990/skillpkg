/**
 * Tool: load_skill
 *
 * Loads a skill's full content including instructions.
 */

import type { ToolHandler, ToolResult, LoadSkillInput, LoadSkillOutput, Scope } from '../types.js';
import { getStore, successResult, errorResult, validateString } from './utils.js';
import { SkillNotInstalledError } from '../types.js';

export function createLoadSkillHandler(): ToolHandler {
  return {
    name: 'load_skill',
    description:
      'Load a skill by ID and return its full content including instructions. The skill must be installed first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Skill ID in format "scope:name" (e.g., "local:commit-helper") or just "name" to search all scopes',
        },
      },
      required: ['id'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as LoadSkillInput;

      try {
        const id = validateString(input.id, 'id');

        // Parse scope from ID
        let scope: Scope | undefined;
        let skillName: string;

        if (id.includes(':')) {
          const [scopePart, namePart] = id.split(':', 2);
          if (scopePart === 'local' || scopePart === 'global') {
            scope = scopePart;
            skillName = namePart;
          } else {
            skillName = id;
          }
        } else {
          skillName = id;
        }

        // Search for the skill
        const scopesToCheck: Scope[] = scope ? [scope] : ['local', 'global'];
        let foundSkill = null;
        let foundScope: Scope | null = null;

        for (const s of scopesToCheck) {
          const store = getStore(s);
          if (!(await store.isInitialized())) {
            continue;
          }

          const skill = await store.getSkill(skillName);
          if (skill) {
            foundSkill = skill;
            foundScope = s;
            break;
          }
        }

        if (!foundSkill || !foundScope) {
          throw new SkillNotInstalledError(skillName);
        }

        const output: LoadSkillOutput = {
          id: `${foundScope}:${foundSkill.name}`,
          name: foundSkill.name,
          version: foundSkill.version,
          description: foundSkill.description,
          instructions: foundSkill.instructions,
          author:
            typeof foundSkill.author === 'string'
              ? { name: foundSkill.author }
              : foundSkill.author,
        };

        // Format output with instructions
        let text = `# ${output.name} v${output.version}\n\n`;
        text += `${output.description}\n\n`;

        if (output.author) {
          text += `Author: ${output.author.name}`;
          if (output.author.email) text += ` <${output.author.email}>`;
          text += '\n\n';
        }

        text += `---\n\n## Instructions\n\n${output.instructions}`;

        return successResult(text);
      } catch (error) {
        if (error instanceof SkillNotInstalledError) {
          return errorResult(error.message, 'Use search_skills to find and install_skill to install it.');
        }
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to load skill: ${message}`);
      }
    },
  };
}
