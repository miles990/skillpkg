/**
 * Tool: fetch_skill_content
 *
 * Fetches and parses SKILL.md content from any supported source.
 * Supports:
 * - GitHub: github:user/repo or github:user/repo#path/to/skill
 * - Gist: gist:id
 * - URL: https://... or http://...
 * - Local: local:skill-name (from installed skills)
 */

import type { ToolHandler, ToolResult } from '../types.js';
import { getStore, successResult, errorResult, validateString } from './utils.js';
import { fetchSkill } from 'skillpkg-core';

export interface FetchSkillContentInput {
  source: string;
}

export interface FetchSkillContentOutput {
  success: boolean;
  name: string;
  version: string;
  description: string;
  author?: string;
  instructions: string;
  keywords?: string[];
  dependencies?: { [key: string]: string };
  sourceUrl?: string;
}

export function createFetchSkillContentHandler(): ToolHandler {
  return {
    name: 'fetch_skill_content',
    description:
      'Fetch and parse SKILL.md content from any source. Returns the skill metadata and full instructions. ' +
      'Use this to preview a skill before installing, or to read the instructions of a remote skill.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'Skill source to fetch. Formats: ' +
            '"github:user/repo" (root SKILL.md), ' +
            '"github:user/repo#path/to/skill" (subpath), ' +
            '"gist:id", ' +
            '"https://..." (direct URL), ' +
            '"local:skill-name" (installed skill)',
        },
      },
      required: ['source'],
    },

    async execute(args: unknown): Promise<ToolResult> {
      const input = args as FetchSkillContentInput;

      try {
        const source = validateString(input.source, 'source');

        // Handle local source specially
        if (source.startsWith('local:')) {
          return await fetchLocalSkill(source.slice(6));
        }

        // Fetch from remote source
        const result = await fetchSkill(source, {
          githubToken: process.env.GITHUB_TOKEN,
          timeout: 30000,
        });

        if (!result.success || !result.skill) {
          return errorResult(
            result.errors?.[0] || `Failed to fetch skill from: ${source}`,
            'Check that the source is valid and the SKILL.md file exists.'
          );
        }

        const skill = result.skill;
        const output: FetchSkillContentOutput = {
          success: true,
          name: skill.name,
          version: skill.version,
          description: skill.description,
          author: formatAuthor(skill.author),
          instructions: skill.instructions,
          keywords: skill.keywords,
          dependencies: skill.dependencies as { [key: string]: string } | undefined,
          sourceUrl: result.sourceUrl,
        };

        // Format output text
        let text = `# ${skill.name} v${skill.version}\n\n`;
        text += `${skill.description}\n\n`;

        if (output.author) {
          text += `**Author:** ${output.author}\n`;
        }

        if (skill.keywords && skill.keywords.length > 0) {
          text += `**Keywords:** ${skill.keywords.join(', ')}\n`;
        }

        if (skill.dependencies && Object.keys(skill.dependencies).length > 0) {
          text += `**Dependencies:** ${Object.entries(skill.dependencies)
            .map(([name, version]) => `${name}@${version}`)
            .join(', ')}\n`;
        }

        if (result.sourceUrl) {
          text += `**Source:** ${result.sourceUrl}\n`;
        }

        text += '\n---\n\n';
        text += '## Instructions\n\n';
        text += skill.instructions;

        return successResult(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Fetch failed: ${message}`);
      }
    },
  };
}

/**
 * Fetch skill from local installation
 */
async function fetchLocalSkill(skillName: string): Promise<ToolResult> {
  // Try local store first, then global
  for (const scope of ['local', 'global'] as const) {
    const store = getStore(scope);
    if (!(await store.isInitialized())) {
      continue;
    }

    try {
      const skill = await store.getSkill(skillName);
      if (skill) {
        let text = `# ${skill.name} v${skill.version} [installed in ${scope}]\n\n`;
        text += `${skill.description}\n\n`;

        if (skill.author) {
          text += `**Author:** ${formatAuthor(skill.author)}\n`;
        }

        if (skill.keywords && skill.keywords.length > 0) {
          text += `**Keywords:** ${skill.keywords.join(', ')}\n`;
        }

        text += '\n---\n\n';
        text += '## Instructions\n\n';
        text += skill.instructions;

        return successResult(text);
      }
    } catch {
      continue;
    }
  }

  return errorResult(
    `Skill "${skillName}" not found in local or global installation.`,
    'Use "skillpkg install <source>" to install the skill first.'
  );
}

/**
 * Format author field for display
 */
function formatAuthor(
  author: { name: string; email?: string; url?: string } | string | undefined
): string | undefined {
  if (!author) return undefined;
  if (typeof author === 'string') return author;

  let result = author.name;
  if (author.email) result += ` <${author.email}>`;
  if (author.url) result += ` (${author.url})`;
  return result;
}
