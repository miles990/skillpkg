/**
 * uninstall command - Remove a skill
 */
import { createGlobalStore, createLocalStore } from '@skillpkg/core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface UninstallOptions {
  global?: boolean;
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

  // Remove skill
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

  logger.blank();
  logger.success(`Removed ${colors.cyan(skillName)}`);
  logger.blank();
}
