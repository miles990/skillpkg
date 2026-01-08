/**
 * Tool: search_skills
 *
 * Multi-source skill discovery with deduplication.
 * Uses DiscoveryManager to search across:
 * - priority: Priority repos (miles990/claude-software-skills, claude-domain-skills) - SEARCHED FIRST
 * - local: Installed skills
 * - skillsmp: Primary registry (40K+ skills, requires API key)
 * - awesome: Fallback curated repos (no key required)
 * - github: Supplementary search (topic-based with SKILL.md detection)
 */

import type {
  ToolHandler,
  ToolResult,
  SearchSkillsInput,
  SearchSkillsOutput,
  SearchSkillResult,
  DiscoverySourceType,
} from '../types.js';
import {
  getStore,
  successResult,
  errorResult,
  validateString,
  validateLimit,
} from './utils.js';
import {
  createDiscoveryManager,
  type DiscoverySource,
  type DiscoveredSkill,
} from 'skillpkg-core';

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
          enum: ['all', 'priority', 'local', 'github'],
          default: 'all',
          description: 'Where to search: all (default), priority (miles990/claude-software-skills first), local (installed only), or github (general GitHub search)',
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
        const sourceInput = (input.source || 'all') as DiscoverySourceType;
        const limit = validateLimit(input.limit, 20, 100);

        // Map input source to discovery sources
        let sources: DiscoverySource[] | undefined;
        if (sourceInput === 'priority') {
          sources = ['priority'];
        } else if (sourceInput === 'local') {
          sources = ['local'];
        } else if (sourceInput === 'github') {
          sources = ['github'];
        } else if (sourceInput === 'skillsmp') {
          sources = ['skillsmp'];
        } else if (sourceInput === 'awesome') {
          sources = ['awesome'];
        }
        // 'all' = undefined, let DiscoveryManager use getDefaultSources()

        // Get local store for DiscoveryManager
        const localStore = getStore('local');
        const globalStore = getStore('global');

        // Check which store is initialized
        let storeManager;
        if (await localStore.isInitialized()) {
          storeManager = localStore;
        } else if (await globalStore.isInitialized()) {
          storeManager = globalStore;
        }

        // Create discovery manager
        const manager = createDiscoveryManager({
          skillsmpApiKey: process.env.SKILLSMP_API_KEY,
          githubToken: process.env.GITHUB_TOKEN,
          storeManager,
        });

        // Search
        const result = await manager.search({
          query,
          limit,
          sources,
        });

        // Convert to output format
        const installedNames = new Set<string>();
        if (storeManager) {
          const skills = await storeManager.listSkills();
          skills.forEach((s) => installedNames.add(s.name));
        }

        const results: SearchSkillResult[] = result.skills.map((skill) =>
          toSearchResult(skill, installedNames)
        );

        const output: SearchSkillsOutput = {
          results,
          total: results.length,
          query,
          duplicatesRemoved: result.duplicatesRemoved,
          sourcesQueried: result.sourcesQueried,
        };

        // Format output text
        if (results.length === 0) {
          let text = `No skills found for "${query}".`;
          if (result.errors) {
            text += '\n\nErrors:';
            for (const [source, error] of Object.entries(result.errors)) {
              text += `\n• ${source}: ${error}`;
            }
          }
          return successResult(text);
        }

        let text = `Found ${output.total} skill(s) for "${query}"`;
        if (output.duplicatesRemoved > 0) {
          text += ` (${output.duplicatesRemoved} duplicates removed)`;
        }
        text += `:\n\n`;

        for (const skill of results) {
          const installed = skill.installed ? ' [installed]' : '';
          const stars = skill.stars ? ` ⭐${skill.stars}` : '';
          const author = skill.author ? ` by ${skill.author}` : '';

          text += `• ${skill.name}${installed}${stars}${author}\n`;
          text += `  ${skill.description}\n`;
          text += `  Source: ${skill.source}\n`;

          if (skill.foundIn && skill.foundIn.length > 1) {
            text += `  Also in: ${skill.foundIn.slice(1).join(', ')}\n`;
          }

          if (skill.tags && skill.tags.length > 0) {
            text += `  Tags: ${skill.tags.join(', ')}\n`;
          }
          text += '\n';
        }

        text += `Sources queried: ${output.sourcesQueried.join(', ')}`;

        if (result.errors) {
          text += '\n\nErrors:';
          for (const [source, error] of Object.entries(result.errors)) {
            text += `\n• ${source}: ${error}`;
          }
        }

        return successResult(text.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Search failed: ${message}`);
      }
    },
  };
}

/**
 * Convert DiscoveredSkill to SearchSkillResult
 */
function toSearchResult(
  skill: DiscoveredSkill,
  installedNames: Set<string>
): SearchSkillResult {
  return {
    id: `${skill.provider}:${skill.name}`,
    name: skill.name,
    description: skill.description,
    source: skill.source,
    provider: skill.provider,
    installed: installedNames.has(skill.name),
    stars: skill.stars,
    author: skill.author,
    updatedAt: skill.lastUpdated,
    tags: skill.keywords,
    foundIn: skill.foundIn,
  };
}
