/**
 * uninstall command - Remove a skill with dependency checking
 *
 * v2.0: Uses new Installer module with dependency awareness
 */
import {
  createGlobalStore,
  createLocalStore,
  createStateManager,
  createConfigManager,
  createInstaller,
  createAdapterManager,
  type SkillFetcherAdapter,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface UninstallOptions {
  global?: boolean;
  clean?: boolean;
  force?: boolean;
}

/**
 * uninstall command handler
 */
export async function uninstallCommand(
  skillName: string,
  options: UninstallOptions
): Promise<void> {
  const cwd = process.cwd();
  const storeManager = options.global ? createGlobalStore() : createLocalStore();
  const stateManager = createStateManager();
  const configManager = createConfigManager();

  // Check if store is initialized
  if (!(await storeManager.isInitialized())) {
    logger.error('No skills installed');
    process.exit(1);
  }

  // Check if skill exists
  if (!(await storeManager.hasSkill(skillName))) {
    logger.error(`Skill ${colors.cyan(skillName)} is not installed`);
    process.exit(1);
  }

  // Get skill info before removal
  const skill = await storeManager.getSkill(skillName);
  const version = skill?.version || 'unknown';

  // Create installer (with minimal fetcher since we're uninstalling)
  const fetcher: SkillFetcherAdapter = {
    async fetchMetadata() {
      return null;
    },
    async fetchSkill() {
      return null;
    },
  };
  const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

  // Check for dependents (unless --force)
  if (!options.force) {
    const check = await installer.canUninstall(cwd, skillName);

    if (!check.canUninstall) {
      logger.error(`Cannot uninstall ${colors.cyan(skillName)}`);
      logger.blank();
      logger.log('The following skills depend on it:');
      for (const dep of check.dependents) {
        logger.item(colors.cyan(dep));
      }
      logger.blank();
      logger.log(`Use ${colors.cyan('--force')} to uninstall anyway`);
      logger.warn('Warning: This may break the dependent skills!');
      process.exit(1);
    }
  }

  // Perform uninstall
  const result = await withSpinner(
    `Uninstalling ${colors.cyan(skillName)}@${version}`,
    () =>
      installer.uninstall(cwd, skillName, {
        force: options.force,
        removeOrphans: true,
      }),
    {
      successText: `Uninstalled ${colors.cyan(skillName)}@${version}`,
      failText: `Failed to uninstall ${skillName}`,
    }
  );

  if (!result.success) {
    logger.error('Uninstall failed:');
    for (const error of result.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
    process.exit(1);
  }

  // Clean synced platform files if --clean flag is set
  if (options.clean) {
    const adapterManager = createAdapterManager();
    await withSpinner(
      `Cleaning synced files from platforms`,
      () => adapterManager.removeFromAllPlatforms(skillName, cwd),
      {
        successText: `Cleaned synced files`,
        failText: `Failed to clean some platform files`,
      }
    );
  }

  logger.blank();
  logger.success(`Removed ${colors.cyan(skillName)}`);

  // Show removed orphans
  if (result.orphansRemoved.length > 0) {
    logger.log(`Also removed ${result.orphansRemoved.length} orphan dependency(s):`);
    for (const orphan of result.orphansRemoved) {
      logger.item(colors.dim(orphan));
    }
  }

  if (options.clean) {
    logger.log(colors.dim('Also removed synced files from all platforms'));
  }

  logger.blank();
}
