/**
 * Tool: create_skill
 *
 * Creates a new skill with SKILL.md format.
 * Useful for AI agents to help users create new skills.
 */

import type { ToolHandler, ToolResult } from '../types.js';
import { successResult, errorResult, validateString } from './utils.js';
import { SkillCreator } from 'skillpkg-core';

export interface CreateSkillInput {
  name: string;
  description?: string;
  instructions?: string;
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate skill name
 */
function validateSkillName(name: string): string | null {
  if (!name) {
    return 'Name is required';
  }

  const normalized = toKebabCase(name);
  if (normalized.length < 2) {
    return 'Name must be at least 2 characters';
  }

  if (normalized.length > 100) {
    return 'Name must be less than 100 characters';
  }

  return null;
}

export function createCreateSkillHandler(): ToolHandler {
  return {
    name: 'create_skill',
    description: `Create a new skill with SKILL.md format.

This tool helps AI agents create new skills for users. It generates:
- A directory with the skill name
- A SKILL.md file with frontmatter and instructions

Parameters:
- name (required): Skill name (will be converted to kebab-case)
- description (optional): Short description of the skill
- instructions (optional): The skill instructions content

Returns the path to the created SKILL.md file.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Skill name (e.g., "my-helper", "code-reviewer")',
        },
        description: {
          type: 'string',
          description: 'Short description of what the skill does',
        },
        instructions: {
          type: 'string',
          description: 'The full instructions content for the skill (markdown)',
        },
      },
      required: ['name'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as CreateSkillInput;

      try {
        const rawName = validateString(input.name, 'name');

        // Validate name
        const nameError = validateSkillName(rawName);
        if (nameError) {
          return errorResult(nameError);
        }

        const skillName = toKebabCase(rawName);
        const description = input.description || 'A helpful skill';
        const instructions = input.instructions;

        const creator = new SkillCreator();

        // Create the skill
        const skillMdPath = await creator.create({
          name: skillName,
          description,
          instructions,
          createDir: true,
        });

        const lines: string[] = [
          `✅ Created skill: ${skillName}`,
          '',
          `📄 File: ${skillMdPath}`,
          '',
          '📋 Next steps:',
          `   • Edit ${skillName}/SKILL.md to customize instructions`,
          `   • Run \`skillpkg install ./${skillName}\` to install locally`,
          `   • Run \`skillpkg sync\` to sync to AI platforms`,
        ];

        return successResult(lines.join('\n'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to create skill: ${message}`);
      }
    },
  };
}
