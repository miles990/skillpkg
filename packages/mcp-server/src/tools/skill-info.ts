/**
 * Tool: skill_info
 *
 * Gets detailed information about a skill from the registry.
 */

import type { ToolHandler, ToolResult, SkillInfoInput, SkillInfoOutput, Author } from '../types.js';
import { getRegistryClient, successResult, errorResult, validateString } from './utils.js';
import { SkillNotFoundError } from '../types.js';

export function createSkillInfoHandler(): ToolHandler {
  return {
    name: 'skill_info',
    description:
      'Get detailed information about a skill from the registry, including versions, readme, and metadata.',
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

        const client = getRegistryClient();

        let skillInfo;
        try {
          skillInfo = await client.getSkillInfo(skillName);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('404') || message.includes('not found')) {
            throw new SkillNotFoundError(skillName);
          }
          throw error;
        }

        const author: Author =
          typeof skillInfo.author === 'string'
            ? { name: skillInfo.author }
            : skillInfo.author || { name: 'Unknown' };

        const output: SkillInfoOutput = {
          name: skillInfo.name,
          description: skillInfo.description,
          version: skillInfo.version,
          author,
          repository: skillInfo.repository,
          license: skillInfo.license,
          tags: skillInfo.keywords,
        };

        // Format detailed output
        let text = `# ${output.name}\n\n`;
        text += `**Version:** ${output.version}\n`;
        text += `**Author:** ${output.author.name}`;
        if (output.author.email) text += ` <${output.author.email}>`;
        if (output.author.url) text += ` (${output.author.url})`;
        text += '\n';

        if (output.license) {
          text += `**License:** ${output.license}\n`;
        }

        if (output.repository) {
          text += `**Repository:** ${output.repository}\n`;
        }

        if (output.tags && output.tags.length > 0) {
          text += `**Tags:** ${output.tags.join(', ')}\n`;
        }

        text += '\n---\n\n';
        text += `${output.description}\n`;

        text += `\n\n---\n\nTo install: install_skill source: "${skillName}"`;

        return successResult(text);
      } catch (error) {
        if (error instanceof SkillNotFoundError) {
          return errorResult(
            `Skill "${input.name}" not found in registry.`,
            'Use search_registry to find available skills.'
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to get skill info: ${message}`);
      }
    },
  };
}
