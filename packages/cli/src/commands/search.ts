/**
 * search command - Search for skills in the registry
 */
import {
  createRegistryClient,
  RegistryError,
  DEFAULT_REGISTRY_URL,
} from 'skillpkg-core';
import type { SearchOptions } from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface SearchCommandOptions {
  limit?: string;
  page?: string;
  sort?: string;
  json?: boolean;
  registry?: string;
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

  const client = createRegistryClient({
    registryUrl: options.registry || DEFAULT_REGISTRY_URL,
  });

  logger.header('Search Skills');
  logger.log(`Searching for: ${colors.cyan(query)}`);
  logger.blank();

  try {
    const searchOptions: SearchOptions = {};

    if (options.limit) {
      searchOptions.limit = parseInt(options.limit, 10);
    }
    if (options.page) {
      searchOptions.page = parseInt(options.page, 10);
    }
    if (options.sort) {
      searchOptions.sort = options.sort as SearchOptions['sort'];
    }

    const result = await client.search(query, searchOptions);

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.results.length === 0) {
      logger.warn('No skills found matching your query');
      return;
    }

    logger.log(`Found ${colors.cyan(String(result.total))} skill(s)`);
    logger.blank();

    // Display results
    for (const item of result.results) {
      const name = colors.cyan(item.name);
      const version = colors.dim(`@${item.version}`);
      const downloads = colors.dim(`(${formatDownloads(item.downloads)} downloads)`);

      logger.log(`${name}${version} ${downloads}`);
      if (item.description) {
        logger.log(`  ${colors.dim(item.description)}`);
      }
      if (item.keywords && item.keywords.length > 0) {
        logger.log(`  ${colors.dim('Keywords:')} ${item.keywords.join(', ')}`);
      }
      logger.blank();
    }

    // Pagination info
    const totalPages = Math.ceil(result.total / result.limit);
    if (totalPages > 1) {
      logger.log(
        colors.dim(`Page ${result.page} of ${totalPages}. `) +
          colors.dim(`Use --page to navigate.`)
      );
    }
  } catch (error) {
    if (error instanceof RegistryError) {
      if (error.code === 'NETWORK_ERROR') {
        logger.error('Unable to connect to registry');
        logger.log(`Registry URL: ${colors.dim(client.getRegistryUrl())}`);
        logger.log('Check your network connection or try again later.');
      } else {
        logger.error(`Registry error: ${error.message}`);
      }
    } else {
      logger.error(`Search failed: ${error instanceof Error ? error.message : error}`);
    }
    process.exit(1);
  }
}

/**
 * Format download count for display
 */
function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}
