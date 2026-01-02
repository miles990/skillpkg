/**
 * uninstall command - Remove a skill
 */
import { createGlobalStore, createLocalStore, createAdapterManager } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface UninstallOptions {
  global?: boolean;
  clean?: boolean;
}

/**
 * uninstall command handler
 */
export async function uninstallCommand(
  skillName: string,
  options: UninstallOptions
): Promise<void> {
  const store = options.global ? createGlobalStore() : createLocalStore();

  // Check if store is initialized
  if (!(await store.isInitialized())) {
    logger.error('No skills installed');
    process.exit(1);
  }

  // Check if skill exists
  if (!(await store.hasSkill(skillName))) {
    logger.error(`Skill ${colors.cyan(skillName)} is not installed`);
    process.exit(1);
  }

  // Get skill info before removal
  const skill = await store.getSkill(skillName);
  const version = skill?.version || 'unknown';

  // Remove skill from store
  const removed = await withSpinner(
    `Uninstalling ${colors.cyan(skillName)}@${version}`,
    () => store.removeSkill(skillName),
    {
      successText: `Uninstalled ${colors.cyan(skillName)}@${version}`,
      failText: `Failed to uninstall ${skillName}`,
    }
  );

  if (!removed) {
    logger.error(`Failed to remove skill ${skillName}`);
    process.exit(1);
  }

  // Clean synced platform files if --clean flag is set
  if (options.clean) {
    const adapterManager = createAdapterManager();
    await withSpinner(
      `Cleaning synced files from platforms`,
      () => adapterManager.removeFromAllPlatforms(skillName, process.cwd()),
      {
        successText: `Cleaned synced files`,
        failText: `Failed to clean some platform files`,
      }
    );
  }

  logger.blank();
  logger.success(`Removed ${colors.cyan(skillName)}`);
  if (options.clean) {
    logger.log(`${colors.dim('Also removed synced files from all platforms')}`);
  }
  logger.blank();
}
