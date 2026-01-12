/**
 * install command - Install a skill with dependency resolution
 *
 * v2.2: Auto-sync after install based on global config
 *
 * Supports:
 * - Local path: skillpkg install ./path/to/skill
 * - GitHub: skillpkg install github:user/repo or skillpkg install user/repo
 * - Gist: skillpkg install gist:id
 * - URL: skillpkg install https://...
 * - Pack file: skillpkg install skill.skillpkg
 */
import { join } from 'path';
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  createLocalStore,
  createGlobalStore,
  createSkillFetcherAdapter,
  normalizeSource,
  loadConfig,
  getGlobalDir,
  createSyncer,
  loadSkillsFromDirectory,
  getTargetConfig,
  getImplementedTargets,
  type SyncTarget,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface InstallOptions {
  global?: boolean;
  registry?: string;
  dryRun?: boolean;
  essentialOnly?: boolean;
}

/**
 * install command handler
 */
export async function installCommand(
  skillArg: string | undefined,
  options: InstallOptions
): Promise<void> {
  const cwd = process.cwd();

  // If no skill argument, install from skillpkg.json
  if (!skillArg) {
    await installFromConfig(cwd, options);
    return;
  }

  // Parse source to get normalized format
  let source: string;
  try {
    source = normalizeSource(skillArg);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Create installer with fetcher
  const stateManager = createStateManager();
  const configManager = createConfigManager();
  const storeManager = options.global ? createGlobalStore() : createLocalStore();
  const fetcher = createSkillFetcherAdapter();

  // Initialize store if needed
  if (!(await storeManager.isInitialized())) {
    await withSpinner('Initializing store', () => storeManager.init());
  }

  const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

  // Dry run mode
  if (options.dryRun) {
    logger.info('Dry run mode - no changes will be made');
    logger.blank();
  }

  logger.info(`Installing from ${colors.cyan(skillArg)}`);
  logger.blank();

  // Run installation
  const result = await withSpinner('Resolving dependencies', async () => {
    return installer.install(cwd, source, {
      dryRun: options.dryRun,
      essentialOnly: options.essentialOnly,
    });
  });

  // Show results
  logger.blank();

  if (!result.success) {
    logger.error('Installation failed:');
    for (const error of result.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
    process.exit(1);
  }

  // Show installed skills
  const installed = result.skills.filter((s) => s.action === 'installed');
  const updated = result.skills.filter((s) => s.action === 'updated');
  const skipped = result.skills.filter((s) => s.action === 'skipped');

  const actionVerb = options.dryRun ? 'Would install' : 'Installed';
  const updateVerb = options.dryRun ? 'Would update' : 'Updated';

  if (installed.length > 0) {
    logger.success(`${actionVerb} ${installed.length} skill(s):`);
    for (const skill of installed) {
      const transitiveNote = skill.transitive
        ? colors.dim(` (dependency of ${skill.requiredBy})`)
        : '';
      logger.item(`${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}${transitiveNote}`);
    }
  }

  if (updated.length > 0) {
    logger.log(`${updateVerb} ${updated.length} skill(s):`);
    for (const skill of updated) {
      logger.item(`${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}`);
    }
  }

  if (skipped.length > 0) {
    logger.log(colors.dim(`Skipped ${skipped.length} already installed skill(s)`));
  }

  // Show MCP requirements
  if (result.mcpRequired.length > 0) {
    logger.blank();
    logger.warn('MCP servers required:');
    for (const mcp of result.mcpRequired) {
      logger.item(`${colors.yellow(mcp)}`);
    }
    logger.log(colors.dim('Configure these in your skillpkg.json or install manually.'));
  }

  // Auto-sync if not dry-run and skills were installed/updated
  if (!options.dryRun && (installed.length > 0 || updated.length > 0)) {
    await autoSyncSkills(cwd, options.global ? 'global' : 'local');
  }

  logger.blank();
}

/**
 * Install all skills from skillpkg.json
 */
async function installFromConfig(cwd: string, options: InstallOptions): Promise<void> {
  const configManager = createConfigManager();
  const config = await configManager.loadProjectConfig(cwd);

  if (!config) {
    logger.error('No skillpkg.json found');
    logger.log(`Run ${colors.cyan('skillpkg init')} to create one`);
    logger.blank();
    logger.log('Or specify a skill to install:');
    logger.item(`${colors.cyan('skillpkg install ./path/to/skill')} - Install from local path`);
    logger.item(`${colors.cyan('skillpkg install github:user/repo')} - Install from GitHub`);
    process.exit(1);
  }

  const skills = Object.keys(config.skills || {});
  if (skills.length === 0) {
    logger.warn('No skills defined in skillpkg.json');
    logger.log(`Add skills using ${colors.cyan('skillpkg install <skill>')}`);
    return;
  }

  // Dry run mode
  if (options.dryRun) {
    logger.info('Dry run mode - no changes will be made');
    logger.blank();
  }

  logger.info(`Installing ${skills.length} skill(s) from skillpkg.json`);
  logger.blank();

  const stateManager = createStateManager();
  const storeManager = options.global ? createGlobalStore() : createLocalStore();
  const fetcher = createSkillFetcherAdapter();

  // Initialize store if needed
  if (!(await storeManager.isInitialized())) {
    await withSpinner('Initializing store', () => storeManager.init());
  }

  const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

  const result = await withSpinner('Installing skills', async () => {
    return installer.installFromConfig(cwd, { dryRun: options.dryRun });
  });

  logger.blank();

  if (!result.success) {
    logger.error('Some installations failed:');
    for (const error of result.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
  }

  // Summary
  const installed = result.skills.filter((s) => s.action === 'installed');
  const skipped = result.skills.filter((s) => s.action === 'skipped');

  logger.log(
    `Summary: ${colors.green(String(installed.length))} installed, ` +
      `${colors.dim(String(skipped.length))} skipped`
  );

  if (result.mcpRequired.length > 0) {
    logger.blank();
    logger.warn(`MCP servers required: ${result.mcpRequired.join(', ')}`);
  }

  // Auto-sync if not dry-run and skills were installed
  if (!options.dryRun && installed.length > 0) {
    await autoSyncSkills(cwd, options.global ? 'global' : 'local');
  }

  logger.blank();
}

/**
 * Auto-sync skills to configured targets after install
 */
async function autoSyncSkills(cwd: string, scope: 'local' | 'global'): Promise<void> {
  // Load global config to get auto-sync targets
  const globalDir = getGlobalDir();
  const globalConfig = await loadConfig(globalDir);

  // Get enabled auto-sync targets
  const enabledTargets = Object.entries(globalConfig.autoSyncTargets)
    .filter(([_, enabled]) => enabled)
    .map(([target]) => target);

  if (enabledTargets.length === 0) {
    return; // No auto-sync targets configured
  }

  // Get implemented targets
  const implementedTargets = getImplementedTargets();
  const implementedIds = new Set(implementedTargets.map((t) => t.id));

  // Filter to only implemented targets
  const validTargets = enabledTargets.filter((t) => implementedIds.has(t as SyncTarget));

  if (validTargets.length === 0) {
    return;
  }

  logger.blank();
  logger.info(`Auto-syncing to: ${validTargets.join(', ')}`);

  // Load skills from store
  const storeDir = scope === 'global' ? globalDir : join(cwd, '.skillpkg');
  const skillsDir = join(storeDir, 'skills');
  const skills = await loadSkillsFromDirectory(skillsDir);

  if (skills.size === 0) {
    return;
  }

  // Create syncer and sync to each target
  const syncer = createSyncer();

  for (const targetId of validTargets) {
    const targetConfig = getTargetConfig(targetId as SyncTarget);

    const result = await withSpinner(`Syncing to ${targetConfig.displayName}`, async () => {
      return syncer.syncToTarget(cwd, skills, targetConfig, { dryRun: false });
    });

    if (result.success) {
      const synced = result.files.filter((f) => f.action === 'created' || f.action === 'updated');
      if (synced.length > 0) {
        logger.success(`Synced ${synced.length} skill(s) to ${targetConfig.displayName}`);
      }
    } else {
      logger.warn(`Failed to sync to ${targetConfig.displayName}: ${result.errors.join(', ')}`);
    }
  }
}
