/**
 * search command - Multi-source skill discovery
 *
 * Searches across multiple sources with deduplication:
 * - local: Installed skills
 * - skillsmp: Primary registry (40K+ skills, requires API key)
 * - awesome: Fallback curated repos (no key required)
 * - github: Supplementary search
 */
import {
  createDiscoveryManager,
  createLocalStore,
  createGlobalStore,
  type DiscoverySource,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface SearchOptions {
  limit?: string;
  source?: string;
  json?: boolean;
}

/**
 * search command handler
 */
export async function searchCommand(
  query: string | undefined,
  options: SearchOptions
): Promise<void> {
  if (!query) {
    logger.error('Search query is required');
    logger.log(`Usage: ${colors.cyan('skillpkg search <query>')}`);
    process.exit(1);
  }

  logger.header('Search Skills');
  logger.log(`Searching for: ${colors.cyan(query)}`);
  logger.blank();

  try {
    const limit = options.limit ? parseInt(options.limit, 10) : 20;

    // Determine sources
    let sources: DiscoverySource[] | undefined;
    if (options.source) {
      const validSources: DiscoverySource[] = ['local', 'skillsmp', 'awesome', 'github'];
      const requestedSource = options.source.toLowerCase() as DiscoverySource;
      if (validSources.includes(requestedSource)) {
        sources = [requestedSource];
      } else if (options.source === 'all') {
        sources = undefined; // Use default
      } else {
        logger.error(`Invalid source: ${options.source}`);
        logger.log(`Valid sources: ${validSources.join(', ')}, all`);
        process.exit(1);
      }
    }

    // Get store manager for local provider
    const localStore = createLocalStore();
    const globalStore = createGlobalStore();
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

    // Show which sources will be queried
    const defaultSources = manager.getDefaultSources();
    const sourcesToQuery = sources || defaultSources;
    logger.log(colors.dim(`Sources: ${sourcesToQuery.join(', ')}`));
    logger.blank();

    // Search
    const result = await manager.search({
      query,
      limit,
      sources,
    });

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.skills.length === 0) {
      logger.warn('No skills found matching your query');
      if (result.errors) {
        logger.blank();
        logger.log(colors.dim('Errors:'));
        for (const [source, error] of Object.entries(result.errors)) {
          logger.log(colors.dim(`  ${source}: ${error}`));
        }
      }
      return;
    }

    // Summary
    let summary = `Found ${colors.cyan(String(result.skills.length))} skill(s)`;
    if (result.duplicatesRemoved > 0) {
      summary += ` (${colors.yellow(String(result.duplicatesRemoved))} duplicates removed)`;
    }
    logger.log(summary);
    logger.blank();

    // Display results
    for (const skill of result.skills) {
      const name = colors.cyan(skill.name);
      const stars = skill.stars ? colors.yellow(` ⭐${formatNumber(skill.stars)}`) : '';
      const author = skill.author ? colors.dim(` by ${skill.author}`) : '';

      logger.log(`${name}${stars}${author}`);

      if (skill.description) {
        logger.log(`  ${skill.description}`);
      }

      // Source URL (for installation)
      logger.log(`  ${colors.dim('Source:')} ${skill.source}`);

      // Show "Also in:" if found in multiple sources
      if (skill.foundIn && skill.foundIn.length > 1) {
        logger.log(`  ${colors.dim('Also in:')} ${skill.foundIn.slice(1).join(', ')}`);
      }

      // Keywords
      if (skill.keywords && skill.keywords.length > 0) {
        logger.log(`  ${colors.dim('Tags:')} ${skill.keywords.slice(0, 5).join(', ')}`);
      }

      logger.blank();
    }

    // Footer
    logger.log(colors.dim('─'.repeat(50)));
    logger.log(`Install: ${colors.cyan('skillpkg install <source>')}`);

    // Show errors if any
    if (result.errors && Object.keys(result.errors).length > 0) {
      logger.blank();
      logger.log(colors.dim('Some sources had errors:'));
      for (const [source, error] of Object.entries(result.errors)) {
        logger.log(colors.dim(`  ${source}: ${error}`));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('rate limit')) {
      logger.error('API rate limit exceeded');
      logger.log(colors.dim('Set GITHUB_TOKEN for higher GitHub limits:'));
      logger.log(colors.dim('  export GITHUB_TOKEN=your_token_here'));
      logger.blank();
      logger.log(colors.dim('Set SKILLSMP_API_KEY for skillsmp.com access:'));
      logger.log(colors.dim('  export SKILLSMP_API_KEY=your_key_here'));
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
