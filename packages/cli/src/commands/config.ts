/**
 * config command - Manage global skillpkg configuration
 *
 * Subcommands:
 * - config get <key>           - Get a config value
 * - config set <key> <value>   - Set a config value
 * - config list                - List all config values
 * - config sync-targets        - List auto-sync targets
 * - config sync-targets add <target>    - Add an auto-sync target
 * - config sync-targets remove <target> - Remove an auto-sync target
 */
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  getGlobalDir,
  getImplementedTargets,
  type SyncTarget,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

/**
 * config list - Show all configuration
 */
export async function configListCommand(): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);

  logger.header('Global Configuration');
  logger.blank();

  logger.log(`${colors.cyan('registry')}: ${config.registry}`);
  logger.log(`${colors.cyan('autoSync')}: ${config.autoSync}`);
  logger.blank();

  logger.log(`${colors.cyan('autoSyncTargets')}:`);
  const targets = Object.entries(config.autoSyncTargets);
  if (targets.length === 0) {
    logger.log('  (none)');
  } else {
    for (const [target, enabled] of targets) {
      const status = enabled ? colors.green('✓') : colors.dim('✗');
      logger.log(`  ${status} ${target}`);
    }
  }

  logger.blank();
}

/**
 * config get - Get a specific config value
 */
export async function configGetCommand(key: string): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);

  if (key === 'autoSyncTargets') {
    const targets = Object.entries(config.autoSyncTargets)
      .filter(([_, enabled]) => enabled)
      .map(([target]) => target);
    logger.log(targets.join(', ') || '(none)');
    return;
  }

  const value = config[key as keyof typeof config];
  if (value === undefined) {
    logger.error(`Unknown config key: ${key}`);
    process.exit(1);
  }

  if (typeof value === 'object') {
    logger.log(JSON.stringify(value, null, 2));
  } else {
    logger.log(String(value));
  }
}

/**
 * config set - Set a config value
 */
export async function configSetCommand(key: string, value: string): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);

  if (key === 'autoSync') {
    config.autoSync = value === 'true' || value === '1';
  } else if (key === 'registry') {
    config.registry = value;
  } else {
    logger.error(`Cannot set config key: ${key}`);
    logger.log('Settable keys: autoSync, registry');
    logger.log(`For autoSyncTargets, use ${colors.cyan('skillpkg config sync-targets add/remove')}`);
    process.exit(1);
  }

  await saveConfig(globalDir, config);
  logger.success(`Set ${key} = ${value}`);
}

/**
 * config reset - Reset config to defaults
 */
export async function configResetCommand(): Promise<void> {
  const globalDir = getGlobalDir();
  const defaultConfig = getDefaultConfig();
  await saveConfig(globalDir, defaultConfig);
  logger.success('Configuration reset to defaults');
}

interface SyncTargetsOptions {
  json?: boolean;
}

/**
 * config sync-targets - List auto-sync targets
 */
export async function syncTargetsListCommand(options: SyncTargetsOptions): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);
  const implementedTargets = getImplementedTargets();
  const implementedIds = new Set(implementedTargets.map((t) => t.id));

  if (options.json) {
    logger.log(JSON.stringify(config.autoSyncTargets, null, 2));
    return;
  }

  logger.header('Auto-Sync Targets');
  logger.blank();

  const enabledTargets = Object.entries(config.autoSyncTargets)
    .filter(([_, enabled]) => enabled)
    .map(([target]) => target);

  if (enabledTargets.length === 0) {
    logger.log('No auto-sync targets configured.');
    logger.log(`Use ${colors.cyan('skillpkg config sync-targets add <target>')} to add one.`);
  } else {
    logger.log('Enabled targets:');
    for (const target of enabledTargets) {
      const implemented = implementedIds.has(target as SyncTarget);
      const status = implemented ? '' : colors.dim(' (not implemented)');
      logger.item(`${colors.cyan(target)}${status}`);
    }
  }

  logger.blank();
  logger.log('Available targets:');
  for (const t of implementedTargets) {
    const enabled = config.autoSyncTargets[t.id];
    const status = enabled ? colors.green(' (enabled)') : '';
    logger.item(`${colors.cyan(t.id)} - ${t.description}${status}`);
  }
  logger.blank();
}

/**
 * config sync-targets add - Add an auto-sync target
 */
export async function syncTargetsAddCommand(target: string): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);
  const implementedTargets = getImplementedTargets();
  const implementedIds = implementedTargets.map((t) => t.id);

  // Validate target
  if (!implementedIds.includes(target as SyncTarget)) {
    logger.error(`Unknown or not implemented target: ${target}`);
    logger.blank();
    logger.log('Available targets:');
    for (const t of implementedTargets) {
      logger.item(`${colors.cyan(t.id)} - ${t.description}`);
    }
    process.exit(1);
  }

  // Check if already enabled
  if (config.autoSyncTargets[target]) {
    logger.warn(`Target ${colors.cyan(target)} is already enabled`);
    return;
  }

  // Add target
  config.autoSyncTargets[target] = true;
  await saveConfig(globalDir, config);

  logger.success(`Added auto-sync target: ${colors.cyan(target)}`);
  logger.log('Skills will be synced to this target after install/update.');
}

/**
 * config sync-targets remove - Remove an auto-sync target
 */
export async function syncTargetsRemoveCommand(target: string): Promise<void> {
  const globalDir = getGlobalDir();
  const config = await loadConfig(globalDir);

  // Check if target exists
  if (!config.autoSyncTargets[target]) {
    logger.warn(`Target ${colors.cyan(target)} is not in auto-sync targets`);
    return;
  }

  // Remove target
  delete config.autoSyncTargets[target];
  await saveConfig(globalDir, config);

  logger.success(`Removed auto-sync target: ${colors.cyan(target)}`);
}

/**
 * Main config command router
 */
export async function configCommand(
  subcommand: string | undefined,
  keyOrTarget: string | undefined,
  value: string | undefined,
  options: SyncTargetsOptions
): Promise<void> {
  // Handle sync-targets subcommand
  if (subcommand === 'sync-targets') {
    if (!keyOrTarget) {
      await syncTargetsListCommand(options);
    } else if (keyOrTarget === 'add' && value) {
      await syncTargetsAddCommand(value);
    } else if (keyOrTarget === 'remove' && value) {
      await syncTargetsRemoveCommand(value);
    } else if (keyOrTarget === 'add' || keyOrTarget === 'remove') {
      logger.error(`Usage: skillpkg config sync-targets ${keyOrTarget} <target>`);
      process.exit(1);
    } else {
      // keyOrTarget is actually the target to add (shorthand)
      await syncTargetsAddCommand(keyOrTarget);
    }
    return;
  }

  // Handle other subcommands
  switch (subcommand) {
    case 'list':
    case undefined:
      await configListCommand();
      break;
    case 'get':
      if (!keyOrTarget) {
        logger.error('Usage: skillpkg config get <key>');
        process.exit(1);
      }
      await configGetCommand(keyOrTarget);
      break;
    case 'set':
      if (!keyOrTarget || value === undefined) {
        logger.error('Usage: skillpkg config set <key> <value>');
        process.exit(1);
      }
      await configSetCommand(keyOrTarget, value);
      break;
    case 'reset':
      await configResetCommand();
      break;
    default:
      logger.error(`Unknown subcommand: ${subcommand}`);
      logger.blank();
      logger.log('Available subcommands:');
      logger.item(`${colors.cyan('list')} - List all configuration`);
      logger.item(`${colors.cyan('get <key>')} - Get a config value`);
      logger.item(`${colors.cyan('set <key> <value>')} - Set a config value`);
      logger.item(`${colors.cyan('sync-targets')} - List auto-sync targets`);
      logger.item(`${colors.cyan('sync-targets add <target>')} - Add auto-sync target`);
      logger.item(`${colors.cyan('sync-targets remove <target>')} - Remove auto-sync target`);
      logger.item(`${colors.cyan('reset')} - Reset to defaults`);
      process.exit(1);
  }
}
