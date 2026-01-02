/**
 * Tool: search_skills
 *
 * Searches for skills in local store and/or GitHub.
 * Uses SKILL.md format (industry standard for Claude Code and OpenAI Codex).
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
  successResult,
  errorResult,
  validateString,
  validateLimit,
  calculateRelevanceScore,
} from './utils.js';
import { searchGitHubSkills } from 'skillpkg-core';

export function createSearchSkillsHandler(): ToolHandler {
  return {
    name: 'search_skills',
    description:
      'Search for skills by keyword. Searches both installed skills and GitHub repositories with SKILL.md files, returning results sorted by relevance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches name, description, and tags)',
        },
        source: {
          type: 'string',
          enum: ['all', 'local', 'github'],
          default: 'all',
          description: 'Where to search: all, local (installed only), or github (GitHub repositories with SKILL.md)',
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

        // Search GitHub
        if (source === 'all' || source === 'github') {
          try {
            const githubResults = await searchGitHubSkills(query, { limit });

            for (const skill of githubResults) {
              const isInstalled = installedNames.has(skill.name);

              // Skip if already in results from local
              if (isInstalled && source === 'all') {
                // Update existing entry with GitHub metadata
                const existing = results.find((r) => r.name === skill.name);
                if (existing) {
                  existing.downloads = skill.stars; // Use stars as popularity metric
                  existing.tags = skill.topics || [];
                }
                continue;
              }

              results.push({
                id: `github:${skill.fullName}`,
                name: skill.name,
                description: skill.description,
                version: '1.0.0', // GitHub doesn't have version info
                source: 'github',
                installed: isInstalled,
                rating: 0,
                downloads: skill.stars, // Use stars as popularity metric
                updatedAt: skill.updatedAt,
                tags: skill.topics || [],
                relevanceScore: calculateRelevanceScore(
                  {
                    name: skill.name,
                    description: skill.description,
                    downloads: skill.stars,
                    updatedAt: skill.updatedAt,
                    tags: skill.topics,
                  },
                  query
                ) + (skill.hasSkill ? 20 : 0), // Boost repos with SKILL.md
              });
            }
          } catch (error) {
            // GitHub might be unavailable or rate limited
            if (source === 'github') {
              const message = error instanceof Error ? error.message : 'Unknown error';
              return errorResult(
                `GitHub search failed: ${message}`,
                'Try searching with source: "local" to see installed skills, or set GITHUB_TOKEN for higher rate limits.'
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
