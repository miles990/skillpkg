/**
 * Tool: search_skills
 *
 * Searches for skills in local store and/or registry.
 */

import type {
  ToolHandler,
  ToolResult,
  SearchSkillsInput,
  SearchSkillsOutput,
  SearchSkillResult,
} from '../types.js';
import type { Scope } from '../types.js';
import {
  getStore,
  getRegistryClient,
  successResult,
  errorResult,
  validateString,
  validateLimit,
  calculateRelevanceScore,
} from './utils.js';

export function createSearchSkillsHandler(): ToolHandler {
  return {
    name: 'search_skills',
    description:
      'Search for skills by keyword. Searches both installed skills and the registry, returning results sorted by relevance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches name, description, and tags)',
        },
        source: {
          type: 'string',
          enum: ['all', 'local', 'registry'],
          default: 'all',
          description: 'Where to search: all, local (installed only), or registry (remote only)',
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of results to return (1-100)',
        },
      },
      required: ['query'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as SearchSkillsInput;

      try {
        const query = validateString(input.query, 'query');
        const source = input.source || 'all';
        const limit = validateLimit(input.limit, 20, 100);

        const results: SearchSkillResult[] = [];
        const installedNames = new Set<string>();

        // Search local stores
        if (source === 'all' || source === 'local') {
          const scopes: Scope[] = ['local', 'global'];

          for (const scope of scopes) {
            const store = getStore(scope);
            if (!(await store.isInitialized())) {
              continue;
            }

            const skills = await store.listSkills();
            const queryLower = query.toLowerCase();

            for (const skill of skills) {
              // Simple text matching
              const nameMatch = skill.name.toLowerCase().includes(queryLower);
              const descMatch = skill.description.toLowerCase().includes(queryLower);

              if (nameMatch || descMatch) {
                installedNames.add(skill.name);

                results.push({
                  id: `${scope}:${skill.name}`,
                  name: skill.name,
                  description: skill.description,
                  version: skill.version,
                  source: 'local',
                  installed: true,
                  rating: 0, // Local skills don't have ratings
                  downloads: 0,
                  updatedAt: skill.installedAt,
                  tags: [],
                  relevanceScore: calculateRelevanceScore(
                    {
                      name: skill.name,
                      description: skill.description,
                      updatedAt: skill.installedAt,
                    },
                    query
                  ),
                });
              }
            }
          }
        }

        // Search registry
        if (source === 'all' || source === 'registry') {
          try {
            const client = getRegistryClient();
            const searchResult = await client.search(query, { limit });

            for (const skill of searchResult.results) {
              const isInstalled = installedNames.has(skill.name);

              // Skip if already in results from local
              if (isInstalled && source === 'all') {
                // Update existing entry with registry metadata
                const existing = results.find((r) => r.name === skill.name);
                if (existing) {
                  existing.downloads = skill.downloads || 0;
                  existing.tags = skill.keywords || [];
                }
                continue;
              }

              results.push({
                id: `registry:${skill.name}`,
                name: skill.name,
                description: skill.description,
                version: skill.version,
                source: 'registry',
                installed: isInstalled,
                rating: 0, // Registry doesn't have ratings yet
                downloads: skill.downloads || 0,
                updatedAt: skill.updatedAt || new Date().toISOString(),
                tags: skill.keywords || [],
                relevanceScore: calculateRelevanceScore(
                  {
                    name: skill.name,
                    description: skill.description,
                    downloads: skill.downloads,
                    updatedAt: skill.updatedAt,
                    tags: skill.keywords,
                  },
                  query
                ),
              });
            }
          } catch {
            // Registry might be unavailable, continue with local results
            if (source === 'registry') {
              return errorResult(
                'Registry is currently unavailable.',
                'Try searching with source: "local" to see installed skills.'
              );
            }
          }
        }

        // Sort by relevance score (descending)
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Apply limit
        const limitedResults = results.slice(0, limit);

        const output: SearchSkillsOutput = {
          results: limitedResults,
          total: results.length,
          query,
        };

        // Format output
        if (limitedResults.length === 0) {
          return successResult(`No skills found for "${query}".`);
        }

        let text = `Found ${output.total} skill(s) for "${query}":\n\n`;

        for (const skill of limitedResults) {
          const installed = skill.installed ? ' [installed]' : '';
          const rating = skill.rating > 0 ? ` ⭐${skill.rating.toFixed(1)}` : '';
          const downloads = skill.downloads > 0 ? ` 📥${skill.downloads}` : '';

          text += `• ${skill.name} v${skill.version}${installed}${rating}${downloads}\n`;
          text += `  ${skill.description}\n`;
          if (skill.tags.length > 0) {
            text += `  Tags: ${skill.tags.join(', ')}\n`;
          }
          text += '\n';
        }

        if (output.total > limit) {
          text += `Showing ${limit} of ${output.total} results.`;
        }

        return successResult(text.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Search failed: ${message}`);
      }
    },
  };
}
