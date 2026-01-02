/**
 * Tool: search_registry
 *
 * Searches the skill registry only (no local search).
 */

import type { ToolHandler, ToolResult, SearchRegistryInput, SearchRegistryOutput } from '../types.js';
import { getRegistryClient, successResult, errorResult, validateString, validateLimit } from './utils.js';
import { RegistryUnavailableError } from '../types.js';

export function createSearchRegistryHandler(): ToolHandler {
  return {
    name: 'search_registry',
    description:
      'Search the skill registry for available skills. Returns skills from the remote registry only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find skills',
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of results (1-100)',
        },
      },
      required: ['query'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as SearchRegistryInput;

      try {
        const query = validateString(input.query, 'query');
        const limit = validateLimit(input.limit, 20, 100);

        const client = getRegistryClient();

        // Check if registry is reachable
        const isReachable = await client.ping();
        if (!isReachable) {
          throw new RegistryUnavailableError();
        }

        const searchResult = await client.search(query, { limit });

        const output: SearchRegistryOutput = {
          results: searchResult.results.map((skill) => ({
            name: skill.name,
            description: skill.description,
            version: skill.version,
            author: skill.author || 'Unknown',
            downloads: skill.downloads || 0,
          })),
          total: searchResult.total,
        };

        // Format output
        if (output.results.length === 0) {
          return successResult(`No skills found in registry for "${query}".`);
        }

        let text = `Registry search for "${query}" (${output.total} results):\n\n`;

        for (const skill of output.results) {
          text += `• ${skill.name} v${skill.version}\n`;
          text += `  ${skill.description}\n`;
          text += `  Author: ${skill.author} | Downloads: ${skill.downloads}\n\n`;
        }

        text += `\nTo install: use install_skill with the skill name.`;

        return successResult(text.trim());
      } catch (error) {
        if (error instanceof RegistryUnavailableError) {
          return errorResult(
            'Registry is currently unavailable.',
            'Try again later or use list_skills to see locally installed skills.'
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Registry search failed: ${message}`);
      }
    },
  };
}
