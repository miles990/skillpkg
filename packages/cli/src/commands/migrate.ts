/**
 * migrate command - Migrate from v1.x to v2.0
 *
 * Generates skillpkg.json and state.json from existing v1.x store.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createConfigManager,
  createStateManager,
  createLocalStore,
  type SkillpkgConfig,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface MigrateOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * migrate command handler
 */
export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const cwd = process.cwd();
  const storeDir = join(cwd, '.skillpkg');
  const skillpkgJsonPath = join(cwd, 'skillpkg.json');
  const stateJsonPath = join(storeDir, 'state.json');

  logger.header('Migrate to skillpkg v2.0');

  // Check if v1.x store exists
  if (!existsSync(storeDir)) {
    logger.error('No .skillpkg directory found');
    logger.log('Nothing to migrate. Use `skillpkg init` to create a new project.');
    process.exit(1);
  }

  // Check if already migrated
  if (existsSync(skillpkgJsonPath) && !options.force) {
    logger.warn('skillpkg.json already exists');
    logger.log(`Use ${colors.cyan('--force')} to overwrite`);
    process.exit(1);
  }

  if (existsSync(stateJsonPath) && !options.force) {
    logger.warn('state.json already exists');
    logger.log(`Use ${colors.cyan('--force')} to overwrite`);
    process.exit(1);
  }

  // Get existing skills from v1.x store
  const store = createLocalStore();

  if (!(await store.isInitialized())) {
    logger.error('Store is not properly initialized');
    logger.log('Run `skillpkg init` to create a new project.');
    process.exit(1);
  }

  const skills = await store.listSkills();

  if (skills.length === 0) {
    logger.warn('No skills found in store');
    logger.log('Creating empty skillpkg.json...');
  } else {
    logger.log(`Found ${colors.cyan(String(skills.length))} skill(s) to migrate`);
  }

  if (options.dryRun) {
    logger.blank();
    logger.warn('Dry run mode - no changes will be made');
    logger.blank();

    // Show what would be created
    logger.log('Would create:');
    logger.item(`${colors.cyan('skillpkg.json')} - Project configuration`);
    logger.item(`${colors.cyan('.skillpkg/state.json')} - Dependency state`);

    if (skills.length > 0) {
      logger.blank();
      logger.log('Skills to include:');
      for (const skill of skills) {
        logger.item(`${colors.cyan(skill.name)} v${skill.version}`);
      }
    }

    logger.blank();
    return;
  }

  // Create skillpkg.json
  const configManager = createConfigManager();
  const stateManager = createStateManager();

  const newConfig: SkillpkgConfig = {
    name: 'migrated-project',
    version: '1.0.0',
    skills: {},
    mcp: {},
    sync_targets: {
      'claude-code': true,
    },
  };

  // Add skills to config (skills is Record<string, string> - name -> source)
  for (const skill of skills) {
    // Determine source from registry entry
    const entry = await store.getSkillEntry(skill.name);
    const source = entry?.sourceUrl || `local:.skillpkg/skills/${skill.name}`;

    // newConfig.skills is optional, but we initialized it above
    if (newConfig.skills) {
      newConfig.skills[skill.name] = source;
    }
  }

  await withSpinner('Creating skillpkg.json', async () => {
    await configManager.saveProjectConfig(cwd, newConfig);
  });

  // Create state.json
  await withSpinner('Creating state.json', async () => {
    // Initialize empty state first
    await stateManager.loadState(cwd);

    // Record each skill as installed by "user" (since they were manually installed in v1.x)
    for (const skill of skills) {
      const entry = await store.getSkillEntry(skill.name);
      const source = entry?.sourceUrl || `local:.skillpkg/skills/${skill.name}`;

      await stateManager.recordSkillInstall(cwd, skill.name, {
        version: skill.version,
        source,
        installed_by: 'user',
      });
    }
  });

  logger.blank();
  logger.success('Migration complete!');
  logger.blank();

  logger.log('Created files:');
  logger.item(`${colors.cyan('skillpkg.json')} - Project configuration`);
  logger.item(`${colors.cyan('.skillpkg/state.json')} - Dependency state`);

  logger.blank();
  logger.log('Next steps:');
  logger.item(`Edit ${colors.cyan('skillpkg.json')} to customize your project`);
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync skills to platforms`);
  logger.item(`Run ${colors.cyan('skillpkg status')} to see project status`);
  logger.blank();
}
