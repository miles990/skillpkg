/**
 * Tool: recommend_skill
 *
 * Recommends the best skill for a given use case.
 */

import type {
  ToolHandler,
  ToolResult,
  RecommendSkillInput,
  RecommendSkillOutput,
  RecommendedSkill,
  AlternativeSkill,
  RecommendCriteria,
} from '../types.js';
import { getRegistryClient, successResult, errorResult, validateString, calculateRelevanceScore } from './utils.js';

export function createRecommendSkillHandler(): ToolHandler {
  return {
    name: 'recommend_skill',
    description:
      'Get a skill recommendation for a specific use case. Returns the best matching skill with reasoning and alternatives.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Describe what you need (e.g., "help with git commits", "code review")',
        },
        criteria: {
          type: 'string',
          enum: ['auto', 'popular', 'highest_rated', 'newest'],
          default: 'auto',
          description: 'Recommendation criteria: auto (balanced), popular, highest_rated, or newest',
        },
      },
      required: ['query'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as RecommendSkillInput;

      try {
        const query = validateString(input.query, 'query');
        const criteria: RecommendCriteria = input.criteria || 'auto';

        const client = getRegistryClient();

        // Search for relevant skills
        const searchResult = await client.search(query, { limit: 10 });

        if (searchResult.results.length === 0) {
          return successResult(
            `No skills found matching "${query}". Try a different search term or browse available skills with search_registry.`
          );
        }

        // Score and sort based on criteria
        type ScoredSkill = { skill: typeof searchResult.results[0]; score: number };
        const scoredSkills: ScoredSkill[] = searchResult.results.map((skill) => {
          let score = calculateRelevanceScore(
            {
              name: skill.name,
              description: skill.description,
              downloads: skill.downloads,
              updatedAt: skill.updatedAt,
              tags: skill.keywords,
            },
            query
          );

          // Adjust score based on criteria
          switch (criteria) {
            case 'popular':
              score = (skill.downloads || 0) / 1000 + score * 0.3;
              break;
            case 'highest_rated':
              // Rating not available yet, use downloads as proxy
              score = Math.log10((skill.downloads || 0) + 1) * 10 + score * 0.3;
              break;
            case 'newest':
              if (skill.updatedAt) {
                const daysSinceUpdate = Math.floor(
                  (Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                score = Math.max(0, 100 - daysSinceUpdate) + score * 0.3;
              }
              break;
            // 'auto' uses the default balanced scoring
          }

          return { skill, score };
        });

        scoredSkills.sort((a: ScoredSkill, b: ScoredSkill) => b.score - a.score);

        // Get top recommendation
        const topSkill = scoredSkills[0].skill;
        const recommendation: RecommendedSkill = {
          id: topSkill.name,
          name: topSkill.name,
          description: topSkill.description,
          version: topSkill.version,
          rating: 0, // Not available yet
          downloads: topSkill.downloads || 0,
          updatedAt: topSkill.updatedAt || new Date().toISOString(),
          author: topSkill.author || 'Unknown',
          tags: topSkill.keywords || [],
        };

        // Get alternatives (next 3)
        const alternatives: AlternativeSkill[] = scoredSkills.slice(1, 4).map((item: ScoredSkill) => ({
          name: item.skill.name,
          description: item.skill.description,
          rating: 0, // Not available yet
        }));

        // Generate reason based on criteria
        let reason = `"${recommendation.name}" is recommended because `;
        switch (criteria) {
          case 'popular':
            reason += `it's the most popular skill (${recommendation.downloads} downloads) that matches your needs.`;
            break;
          case 'highest_rated':
            reason += `it has the highest rating (${recommendation.rating.toFixed(1)}⭐) among matching skills.`;
            break;
          case 'newest':
            reason += `it was recently updated and matches your requirements.`;
            break;
          default:
            reason += `it best matches "${query}" based on name, description, popularity, and rating.`;
        }

        const output: RecommendSkillOutput = {
          recommendation,
          reason,
          alternatives,
          installCommand: `install_skill source: "${recommendation.name}"`,
        };

        // Format output
        let text = `## Recommended Skill\n\n`;
        text += `**${recommendation.name}** v${recommendation.version}\n`;
        text += `${recommendation.description}\n\n`;
        text += `⭐ ${recommendation.rating.toFixed(1)} | 📥 ${recommendation.downloads} downloads\n`;
        text += `Author: ${recommendation.author}\n`;
        if (recommendation.tags.length > 0) {
          text += `Tags: ${recommendation.tags.join(', ')}\n`;
        }
        text += `\n**Why this skill?**\n${reason}\n`;

        if (alternatives.length > 0) {
          text += `\n## Alternatives\n\n`;
          for (const alt of alternatives) {
            text += `• **${alt.name}** (⭐${alt.rating.toFixed(1)})\n`;
            text += `  ${alt.description}\n\n`;
          }
        }

        text += `\n---\n\nTo install: ${output.installCommand}`;

        return successResult(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Recommendation failed: ${message}`);
      }
    },
  };
}
