/**
 * install command - Install a skill with dependency resolution
 *
 * v2.1: Uses unified fetcher from skillpkg-core
 *
 * Supports:
 * - Local path: skillpkg install ./path/to/skill
 * - GitHub: skillpkg install github:user/repo or skillpkg install user/repo
 * - Gist: skillpkg install gist:id
 * - URL: skillpkg install https://...
 * - Pack file: skillpkg install skill.skillpkg
 */
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  createLocalStore,
  createGlobalStore,
  createSkillFetcherAdapter,
  normalizeSource,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface InstallOptions {
  global?: boolean;
  registry?: string;
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

  logger.info(`Installing from ${colors.cyan(skillArg)}`);
  logger.blank();

  // Run installation
  const result = await withSpinner('Resolving dependencies', async () => {
    return installer.install(cwd, source);
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

  if (installed.length > 0) {
    logger.success(`Installed ${installed.length} skill(s):`);
    for (const skill of installed) {
      const transitiveNote = skill.transitive
        ? colors.dim(` (dependency of ${skill.requiredBy})`)
        : '';
      logger.item(`${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}${transitiveNote}`);
    }
  }

  if (updated.length > 0) {
    logger.log(`Updated ${updated.length} skill(s):`);
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

  logger.blank();
  logger.log('Next steps:');
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.item(`Run ${colors.cyan('skillpkg tree')} to see dependency tree`);
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
    return installer.installFromConfig(cwd);
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

  logger.blank();
}
