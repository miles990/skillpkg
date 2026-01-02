/**
 * search command - Search for skills on GitHub
 *
 * Uses GitHub API to find repositories with SKILL.md files.
 * SKILL.md is the industry standard for Claude Code and OpenAI Codex.
 */
import { searchGitHubSkills } from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface SearchCommandOptions {
  limit?: string;
  json?: boolean;
}

/**
 * search command handler
 */
export async function searchCommand(
  query: string | undefined,
  options: SearchCommandOptions
): Promise<void> {
  if (!query) {
    logger.error('Search query is required');
    logger.log(`Usage: ${colors.cyan('skillpkg search <query>')}`);
    process.exit(1);
  }

  logger.header('Search Skills on GitHub');
  logger.log(`Searching for: ${colors.cyan(query)}`);
  logger.blank();

  try {
    const limit = options.limit ? parseInt(options.limit, 10) : 20;

    const results = await searchGitHubSkills(query, { limit });

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      logger.warn('No skills found matching your query');
      logger.log(colors.dim('Try different keywords or check GitHub directly.'));
      return;
    }

    // Count skills with SKILL.md
    const withSkillMd = results.filter((r) => r.hasSkill).length;
    logger.log(
      `Found ${colors.cyan(String(results.length))} repository(s)` +
        (withSkillMd > 0 ? ` (${colors.green(String(withSkillMd))} with SKILL.md)` : '')
    );
    logger.blank();

    // Display results
    for (const item of results) {
      const name = colors.cyan(item.name);
      const hasSkill = item.hasSkill ? colors.green(' ✓ SKILL.md') : '';
      const stars = colors.yellow(`⭐${formatNumber(item.stars)}`);

      logger.log(`${name}${hasSkill} ${stars}`);
      logger.log(`  ${colors.dim(item.fullName)}`);
      if (item.description) {
        logger.log(`  ${item.description}`);
      }
      if (item.topics && item.topics.length > 0) {
        logger.log(`  ${colors.dim('Topics:')} ${item.topics.slice(0, 5).join(', ')}`);
      }
      if (item.installSource) {
        logger.log(`  ${colors.dim('Install:')} skillpkg install ${item.installSource}`);
      }
      logger.blank();
    }

    // Tip
    if (withSkillMd === 0) {
      logger.log(
        colors.dim(
          'Tip: Repositories with SKILL.md can be installed directly. ' +
            'Others may require manual setup.'
        )
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('rate limit')) {
      logger.error('GitHub API rate limit exceeded');
      logger.log(
        colors.dim('Set GITHUB_TOKEN environment variable for higher limits:')
      );
      logger.log(colors.dim('  export GITHUB_TOKEN=your_token_here'));
    } else {
      logger.error(`Search failed: ${message}`);
    }
    process.exit(1);
  }
}

/**
 * Format number for display (1000 -> 1K, 1000000 -> 1M)
 */
function formatNumber(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}
