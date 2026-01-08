/**
 * Tool: recommend_skills
 *
 * Analyzes user goals and recommends relevant skills using the MatchingEngine.
 * Uses installed skills' triggers/keywords for intelligent matching.
 */

import type { ToolHandler, ToolResult, Scope } from '../types.js';
import { getStore, successResult, errorResult, validateString } from './utils.js';
import { MatchingEngine, type SkillData, type SkillRecommendation } from 'skillpkg-core';

export interface RecommendSkillsInput {
  /** User goal or task description */
  goal: string;
  /** Whether to include GitHub search results (default: false) */
  includeExternal?: boolean;
  /** Minimum confidence threshold (default: 0.3) */
  minConfidence?: number;
}

/**
 * Load installed skills and convert to SkillData format
 */
async function loadInstalledSkillsAsData(): Promise<SkillData[]> {
  const skills: SkillData[] = [];
  const scopes: Scope[] = ['local', 'global'];

  for (const scope of scopes) {
    try {
      const store = getStore(scope);
      if (!(await store.isInitialized())) {
        continue;
      }

      const installed = await store.listSkills();

      for (const skillMeta of installed) {
        try {
          const skill = await store.getSkill(skillMeta.name);
          if (!skill) continue;

          // Determine skill type based on name patterns or tags
          const isDomain =
            skillMeta.name.includes('trading') ||
            skillMeta.name.includes('analysis') ||
            skillMeta.name.includes('design') ||
            skillMeta.name.includes('management') ||
            skillMeta.name.includes('production') ||
            skillMeta.name.includes('creative');

          // Extract triggers and dependencies from skill metadata
          // Use type assertion to access properties that may not be in the Skill interface yet
          const skillAny = skill as unknown as {
            triggers?: SkillData['triggers'];
            dependencies?: SkillData['dependencies'];
          };
          const triggers = skillAny.triggers;
          const dependencies = skillAny.dependencies;

          skills.push({
            name: skill.name,
            description: skill.description || '',
            type: isDomain ? 'domain' : 'software',
            triggers,
            dependencies,
          });
        } catch {
          // Skip skills that can't be read
        }
      }
    } catch {
      // Scope might not exist
    }
  }

  return skills;
}

/**
 * Format SkillRecommendation as readable text
 */
function formatRecommendation(rec: SkillRecommendation): string {
  let text = `## Skill Recommendation\n\n`;
  text += `**Goal:** ${rec.goal}\n`;
  text += `**Extracted Keywords:** ${rec.extractedKeywords.join(', ')}\n`;
  text += `**Overall Confidence:** ${(rec.overall_confidence * 100).toFixed(0)}%\n\n`;

  if (rec.research_mode) {
    text += `⚠️ **Research Mode Triggered** (confidence < 50%)\n\n`;
    text += `The system doesn't have enough matching skills for this goal.\n\n`;

    if (rec.research_suggestions && rec.research_suggestions.length > 0) {
      text += `**Suggestions:**\n`;
      for (const suggestion of rec.research_suggestions) {
        text += `• ${suggestion}\n`;
      }
      text += `\n`;
    }
  }

  if (rec.domain_skills.length > 0) {
    text += `### Domain Skills\n\n`;
    for (const skill of rec.domain_skills) {
      const conf = (skill.confidence * 100).toFixed(0);
      text += `• **${skill.name}** (${conf}% confidence, ${skill.priority} priority)\n`;
      text += `  ${skill.reason}\n`;
      text += `  Matched: ${skill.matchedKeywords.join(', ')}\n\n`;
    }
  }

  if (rec.software_skills.length > 0) {
    text += `### Software Skills\n\n`;
    for (const skill of rec.software_skills) {
      const conf = (skill.confidence * 100).toFixed(0);
      text += `• **${skill.name}** (${conf}% confidence, ${skill.priority} priority)\n`;
      text += `  ${skill.reason}\n`;
      text += `  Matched: ${skill.matchedKeywords.join(', ')}\n\n`;
    }
  }

  if (rec.from_dependencies.length > 0) {
    text += `### From Domain Dependencies\n\n`;
    text += `These software skills are recommended based on domain skill dependencies:\n`;
    for (const dep of rec.from_dependencies) {
      text += `• ${dep}\n`;
    }
    text += `\n`;
  }

  if (rec.domain_skills.length === 0 && rec.software_skills.length === 0) {
    text += `No matching skills found.\n\n`;
    text += `Try:\n`;
    text += `• Using more specific keywords\n`;
    text += `• Installing more skills with \`install_skill\`\n`;
    text += `• Searching GitHub with \`search_skills\`\n`;
  }

  return text;
}

export function createRecommendSkillsHandler(): ToolHandler {
  return {
    name: 'recommend_skills',
    description:
      'Analyze a user goal and recommend relevant skills using keyword matching. ' +
      'Returns domain skills, software skills, and dependencies. ' +
      'Triggers research mode when confidence is low.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'User goal or task description (e.g., "build a quant trading system")',
        },
        includeExternal: {
          type: 'boolean',
          default: false,
          description: 'Whether to include GitHub search results when local matches are insufficient',
        },
        minConfidence: {
          type: 'number',
          default: 0.3,
          minimum: 0,
          maximum: 1,
          description: 'Minimum confidence threshold for recommendations (0-1)',
        },
      },
      required: ['goal'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as RecommendSkillsInput;

      try {
        const goal = validateString(input.goal, 'goal');
        const minConfidence = input.minConfidence ?? 0.3;

        // Initialize matching engine
        const engine = new MatchingEngine({
          minConfidence,
          researchThreshold: 0.5,
          maxResults: 5,
        });

        // Load installed skills
        const skills = await loadInstalledSkillsAsData();

        if (skills.length === 0) {
          return successResult(
            '## No Skills Installed\n\n' +
              'No skills are currently installed. Install some skills first:\n\n' +
              '• `install_skill source: "github:miles990/claude-software-skills"`\n' +
              '• `install_skill source: "github:miles990/claude-domain-skills"`\n' +
              '• `search_skills query: "your topic"`'
          );
        }

        // Analyze goal and get recommendations
        const recommendation = engine.analyze(goal, skills);

        // Format and return result
        const text = formatRecommendation(recommendation);

        return successResult(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Recommendation failed: ${message}`);
      }
    },
  };
}
