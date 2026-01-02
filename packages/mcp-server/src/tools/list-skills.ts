/**
 * Tool: list_skills
 *
 * Lists all installed skills in local or global scope.
 */

import type { ToolHandler, ToolResult, ListSkillsInput, ListSkillsOutput, Scope } from '../types.js';
import { getStore, successResult, errorResult } from './utils.js';

export function createListSkillsHandler(): ToolHandler {
  return {
    name: 'list_skills',
    description:
      'List all installed skills. Returns skill metadata including name, version, description, and installation date.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['local', 'global', 'all'],
          default: 'all',
          description: 'Scope to list skills from: local (project), global (~/.skillpkg), or all',
        },
      },
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as ListSkillsInput;
      const scopeFilter = input.scope || 'all';

      try {
        const results: ListSkillsOutput['skills'] = [];

        // Get skills from requested scopes
        const scopes: Scope[] =
          scopeFilter === 'all' ? ['local', 'global'] : [scopeFilter as Scope];

        for (const scope of scopes) {
          const store = getStore(scope);

          // Initialize store if needed
          if (!(await store.isInitialized())) {
            continue;
          }

          const skills = await store.listSkills();

          for (const skill of skills) {
            results.push({
              id: `${scope}:${skill.name}`,
              name: skill.name,
              description: skill.description,
              version: skill.version,
              scope,
              installedAt: skill.installedAt,
            });
          }
        }

        // Sort by name
        results.sort((a, b) => a.name.localeCompare(b.name));

        // Format output
        if (results.length === 0) {
          return successResult('No skills installed. Use install_skill to add skills.');
        }

        let text = `Found ${results.length} installed skill(s):\n\n`;
        for (const skill of results) {
          text += `• ${skill.name} v${skill.version} [${skill.scope}]\n`;
          text += `  ${skill.description}\n`;
          text += `  Installed: ${new Date(skill.installedAt).toLocaleDateString()}\n\n`;
        }

        return successResult(text.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Failed to list skills: ${message}`);
      }
    },
  };
}
