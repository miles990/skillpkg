/**
 * Tool: recommend_skill
 *
 * Recommends the best skill for a given use case.
 * Searches GitHub for repositories with SKILL.md files.
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
import { successResult, errorResult, validateString, calculateRelevanceScore } from './utils.js';
import { searchGitHubSkills, type GitHubSkillResult } from './github-search.js';

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

        // Search GitHub for skills with SKILL.md
        const githubResults = await searchGitHubSkills(query, { limit: 10 });

        if (githubResults.length === 0) {
          return successResult(
            `No skills found matching "${query}". Try a different search term or search GitHub manually for SKILL.md files.`
          );
        }

        // Score and sort based on criteria
        type ScoredSkill = { skill: GitHubSkillResult; score: number };
        const scoredSkills: ScoredSkill[] = githubResults.map((skill) => {
          let score = calculateRelevanceScore(
            {
              name: skill.name,
              description: skill.description,
              downloads: skill.stars, // Use stars as popularity metric
              updatedAt: skill.updatedAt,
              tags: skill.topics,
            },
            query
          );

          // Boost repos with SKILL.md
          if (skill.hasSkill) {
            score += 30;
          }

          // Adjust score based on criteria
          switch (criteria) {
            case 'popular':
              score = skill.stars / 100 + score * 0.3;
              break;
            case 'highest_rated':
              // Use stars as rating proxy
              score = Math.log10(skill.stars + 1) * 10 + score * 0.3;
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
          id: topSkill.fullName,
          name: topSkill.name,
          description: topSkill.description,
          version: '1.0.0', // GitHub doesn't have version info
          rating: 0,
          downloads: topSkill.stars,
          updatedAt: topSkill.updatedAt,
          author: topSkill.fullName.split('/')[0], // Extract owner from fullName
          tags: topSkill.topics || [],
        };

        // Get alternatives (next 3)
        const alternatives: AlternativeSkill[] = scoredSkills.slice(1, 4).map((item: ScoredSkill) => ({
          name: item.skill.name,
          description: item.skill.description,
          rating: 0,
        }));

        // Generate reason based on criteria
        let reason = `"${recommendation.name}" is recommended because `;
        const hasSkillMd = topSkill.hasSkill ? ' It has a SKILL.md file with proper instructions.' : '';
        switch (criteria) {
          case 'popular':
            reason += `it's the most popular (⭐${recommendation.downloads}) that matches your needs.${hasSkillMd}`;
            break;
          case 'highest_rated':
            reason += `it has the highest stars (⭐${recommendation.downloads}) among matching skills.${hasSkillMd}`;
            break;
          case 'newest':
            reason += `it was recently updated and matches your requirements.${hasSkillMd}`;
            break;
          default:
            reason += `it best matches "${query}" based on name, description, and popularity.${hasSkillMd}`;
        }

        // Determine install source
        const installSource = topSkill.installSource || `github:${topSkill.fullName}`;

        const output: RecommendSkillOutput = {
          recommendation,
          reason,
          alternatives,
          installCommand: `install_skill source: "${installSource}"`,
        };

        // Format output
        let text = `## Recommended Skill\n\n`;
        text += `**${recommendation.name}**${topSkill.hasSkill ? ' ✓ SKILL.md' : ''}\n`;
        text += `${recommendation.description}\n\n`;
        text += `⭐ ${recommendation.downloads} stars | 🔗 ${topSkill.url}\n`;
        text += `Owner: ${recommendation.author}\n`;
        if (recommendation.tags.length > 0) {
          text += `Topics: ${recommendation.tags.join(', ')}\n`;
        }
        text += `\n**Why this skill?**\n${reason}\n`;

        if (alternatives.length > 0) {
          text += `\n## Alternatives\n\n`;
          for (const alt of alternatives) {
            const altSkill = scoredSkills.find((s) => s.skill.name === alt.name)?.skill;
            const hasSkill = altSkill?.hasSkill ? ' ✓' : '';
            text += `• **${alt.name}**${hasSkill} (⭐${altSkill?.stars || 0})\n`;
            text += `  ${alt.description}\n\n`;
          }
        }

        text += `\n---\n\nTo install: ${output.installCommand}`;

        return successResult(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(
          `Recommendation failed: ${message}`,
          'Set GITHUB_TOKEN environment variable for higher API rate limits.'
        );
      }
    },
  };
}
