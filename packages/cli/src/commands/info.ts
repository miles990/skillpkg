/**
 * info command - Get detailed information about an installed skill
 */
import { createGlobalStore, createLocalStore, getSkillMdPath } from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface InfoOptions {
  json?: boolean;
  global?: boolean;
}

/**
 * info command handler
 */
export async function infoCommand(
  skillName: string | undefined,
  options: InfoOptions
): Promise<void> {
  if (!skillName) {
    logger.error('Skill name is required');
    logger.log(`Usage: ${colors.cyan('skillpkg info <skill>')}`);
    process.exit(1);
  }

  // Try local first, then global
  const stores = options.global
    ? [createGlobalStore()]
    : [createLocalStore(), createGlobalStore()];

  for (const store of stores) {
    const skill = await store.getSkill(skillName);
    if (!skill) continue;

    const entry = await store.getSkillEntry(skillName);
    const storeDir = store.getStoreDir();
    const skillPath = getSkillMdPath(storeDir, skillName);
    const scope = storeDir.includes('.skillpkg') && !storeDir.includes('/.skillpkg')
      ? 'global'
      : 'local';

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify({
        name: skill.name,
        version: skill.version,
        description: skill.description,
        author: skill.author,
        scope,
        path: skillPath,
        installedAt: entry?.installedAt,
        source: entry?.source,
        sourceUrl: entry?.sourceUrl,
        syncedPlatforms: entry?.syncedPlatforms || [],
      }, null, 2));
      return;
    }

    // Display info
    logger.header(`${skill.name} (${scope})`);

    logger.log(`${colors.dim('Version:')}     ${skill.version}`);
    if (skill.description) {
      logger.log(`${colors.dim('Description:')} ${skill.description}`);
    }
    if (skill.author) {
      const author = typeof skill.author === 'string'
        ? skill.author
        : skill.author.name;
      logger.log(`${colors.dim('Author:')}      ${author}`);
    }

    logger.blank();

    logger.log(`${colors.dim('Path:')}        ${skillPath}`);
    if (entry?.source) {
      logger.log(`${colors.dim('Source:')}      ${entry.source}`);
    }
    if (entry?.sourceUrl) {
      logger.log(`${colors.dim('Source URL:')}  ${colors.cyan(entry.sourceUrl)}`);
    }
    if (entry?.installedAt) {
      logger.log(`${colors.dim('Installed:')}   ${formatDate(entry.installedAt)}`);
    }

    if (entry?.syncedPlatforms && entry.syncedPlatforms.length > 0) {
      logger.blank();
      logger.log(`${colors.dim('Synced to:')}   ${entry.syncedPlatforms.join(', ')}`);
    }

    logger.blank();

    // Show instructions preview
    if (skill.instructions) {
      const preview = skill.instructions.substring(0, 200);
      logger.log(colors.dim('Instructions preview:'));
      logger.log(colors.dim('─'.repeat(40)));
      logger.log(preview + (skill.instructions.length > 200 ? '...' : ''));
      logger.log(colors.dim('─'.repeat(40)));
      logger.blank();
    }

    // Actions
    logger.log('Actions:');
    logger.log(`  ${colors.cyan(`skillpkg uninstall ${skill.name}`)}`);
    logger.log(`  ${colors.cyan(`skillpkg sync`)}`);
    logger.blank();

    return;
  }

  // Not found
  logger.error(`Skill '${skillName}' is not installed`);
  logger.log(`Try: ${colors.cyan(`skillpkg search ${skillName}`)}`);
  process.exit(1);
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
