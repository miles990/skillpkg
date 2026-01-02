/**
 * info command - Get detailed information about a skill
 */
import {
  createRegistryClient,
  RegistryError,
  DEFAULT_REGISTRY_URL,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface InfoCommandOptions {
  json?: boolean;
  registry?: string;
}

/**
 * info command handler
 */
export async function infoCommand(
  skillName: string | undefined,
  options: InfoCommandOptions
): Promise<void> {
  if (!skillName) {
    logger.error('Skill name is required');
    logger.log(`Usage: ${colors.cyan('skillpkg info <skill>')}`);
    process.exit(1);
  }

  const client = createRegistryClient({
    registryUrl: options.registry || DEFAULT_REGISTRY_URL,
  });

  try {
    const info = await client.getSkillInfo(skillName);

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    logger.header(`${info.name}`);

    // Basic info
    logger.log(`${colors.dim('Version:')}     ${info.version}`);
    if (info.description) {
      logger.log(`${colors.dim('Description:')} ${info.description}`);
    }
    if (info.author) {
      const author = info.author.email
        ? `${info.author.name} <${info.author.email}>`
        : info.author.name;
      logger.log(`${colors.dim('Author:')}      ${author}`);
    }
    if (info.license) {
      logger.log(`${colors.dim('License:')}     ${info.license}`);
    }
    if (info.homepage) {
      logger.log(`${colors.dim('Homepage:')}    ${colors.cyan(info.homepage)}`);
    }
    if (info.repository) {
      logger.log(`${colors.dim('Repository:')}  ${colors.cyan(info.repository)}`);
    }

    logger.blank();

    // Downloads
    logger.log(colors.dim('Downloads:'));
    logger.log(`  Total:   ${formatNumber(info.downloads.total)}`);
    logger.log(`  Weekly:  ${formatNumber(info.downloads.weekly)}`);
    logger.log(`  Monthly: ${formatNumber(info.downloads.monthly)}`);

    logger.blank();

    // Keywords
    if (info.keywords && info.keywords.length > 0) {
      logger.log(`${colors.dim('Keywords:')} ${info.keywords.join(', ')}`);
      logger.blank();
    }

    // Versions
    if (info.versions && info.versions.length > 0) {
      logger.log(colors.dim('Versions:'));
      const displayVersions = info.versions.slice(0, 5);
      for (const ver of displayVersions) {
        const date = new Date(ver.publishedAt).toLocaleDateString();
        const deprecated = ver.deprecated ? colors.yellow(' (deprecated)') : '';
        logger.log(`  ${ver.version} - ${colors.dim(date)}${deprecated}`);
      }
      if (info.versions.length > 5) {
        logger.log(colors.dim(`  ... and ${info.versions.length - 5} more`));
      }
      logger.blank();
    }

    // Dates
    logger.log(`${colors.dim('Created:')}  ${formatDate(info.createdAt)}`);
    logger.log(`${colors.dim('Updated:')}  ${formatDate(info.updatedAt)}`);

    logger.blank();

    // Install command
    logger.log('Install:');
    logger.log(`  ${colors.cyan(`skillpkg install ${info.name}`)}`);
    logger.blank();
  } catch (error) {
    if (error instanceof RegistryError) {
      if (error.code === 'SKILL_NOT_IN_REGISTRY') {
        logger.error(`Skill '${skillName}' not found in registry`);
        logger.log(`Try: ${colors.cyan(`skillpkg search ${skillName}`)}`);
      } else if (error.code === 'NETWORK_ERROR') {
        logger.error('Unable to connect to registry');
        logger.log(`Registry URL: ${colors.dim(client.getRegistryUrl())}`);
      } else {
        logger.error(`Registry error: ${error.message}`);
      }
    } else {
      logger.error(`Failed to get skill info: ${error instanceof Error ? error.message : error}`);
    }
    process.exit(1);
  }
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
