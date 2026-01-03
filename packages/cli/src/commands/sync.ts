/**
 * sync command - Sync skills to platforms
 *
 * v2.0: Uses new Syncer module from core
 */
import { join } from 'path';
import {
  createSyncer,
  createConfigManager,
  createLocalStore,
  createStateManager,
  loadSkillsFromDirectory,
  getTargetConfig,
  getImplementedTargets,
  type TargetSyncResult,
  type SyncTarget,
  type TargetConfig,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface SyncOptions {
  target?: string;
  dryRun?: boolean;
}

/**
 * sync command handler
 */
export async function syncCommand(
  skillName: string | undefined,
  options: SyncOptions
): Promise<void> {
  const cwd = process.cwd();
  const configManager = createConfigManager();
  const syncer = createSyncer();

  // Load project config
  const config = await configManager.loadProjectConfig(cwd);

  // Get skills directory
  const skillsDir = join(cwd, '.skillpkg', 'skills');

  // Load skills from store (returns Map<string, SkillContent>)
  let skills = await loadSkillsFromDirectory(skillsDir);

  if (skills.size === 0) {
    logger.error('No skills installed');
    logger.log(`Run ${colors.cyan('skillpkg install <skill>')} first`);
    process.exit(1);
  }

  // Filter by name if provided
  if (skillName) {
    if (!skills.has(skillName)) {
      logger.error(`Skill ${colors.cyan(skillName)} not found`);
      process.exit(1);
    }
    const skill = skills.get(skillName)!;
    skills = new Map([[skillName, skill]]);
  }

  logger.header('Sync Skills to Platforms');

  // Determine targets
  let targetConfigs: TargetConfig[];

  // Get implemented targets (TargetConfig[])
  const implementedTargets = getImplementedTargets();
  const implementedIds = implementedTargets.map((t) => t.id);

  if (options.target) {
    // User specified targets
    const requestedTargets = options.target.split(',').map((t) => t.trim());

    // Validate target names
    const invalidTargets = requestedTargets.filter((t) => !implementedIds.includes(t as SyncTarget));

    if (invalidTargets.length > 0) {
      logger.error(`Unknown or unimplemented targets: ${invalidTargets.join(', ')}`);
      logger.blank();
      logger.log('Available targets:');
      for (const tc of implementedTargets) {
        logger.item(`${colors.cyan(tc.id)} - ${tc.description}`);
      }
      process.exit(1);
    }

    // Get target configs for valid targets
    targetConfigs = requestedTargets.map((t) => getTargetConfig(t as SyncTarget));
  } else if (config?.sync_targets) {
    // Use targets from config
    const enabledTargets = Object.entries(config.sync_targets)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    if (enabledTargets.length === 0) {
      logger.warn('No sync targets enabled in skillpkg.json');
      logger.log(`Add targets to ${colors.cyan('sync_targets')} in skillpkg.json`);
      logger.blank();
      logger.log('Available targets:');
      for (const tc of implementedTargets) {
        logger.item(`${colors.cyan(tc.id)} - ${tc.description}`);
      }
      process.exit(1);
    }

    // Filter to only implemented targets
    const validTargets = enabledTargets.filter((t) => implementedIds.includes(t as SyncTarget));
    targetConfigs = validTargets.map((t) => getTargetConfig(t as SyncTarget));
  } else {
    // Default to claude-code
    targetConfigs = [getTargetConfig('claude-code')];
    logger.warn('No skillpkg.json found, using default target: claude-code');
  }

  logger.log(`Skills to sync: ${colors.cyan(String(skills.size))}`);
  logger.log(`Targets: ${colors.cyan(targetConfigs.map((t) => t.id).join(', '))}`);
  logger.blank();

  if (options.dryRun) {
    logger.warn('Dry run mode - no changes will be made');
    logger.blank();
  }

  // Sync to each target
  const results: TargetSyncResult[] = [];

  for (const targetConfig of targetConfigs) {
    const result = await withSpinner(
      `Syncing to ${targetConfig.displayName}`,
      async () => {
        return syncer.syncToTarget(cwd, skills, targetConfig, {
          dryRun: options.dryRun,
        });
      },
      {
        successText: `Synced to ${targetConfig.displayName}`,
        failText: `Failed to sync to ${targetConfig.displayName}`,
      }
    );

    results.push(result);
  }

  logger.blank();

  // Show results
  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const result of results) {
    // Count synced files
    const synced = result.files.filter((f) => f.action === 'created' || f.action === 'updated');
    const skipped = result.files.filter((f) => f.action === 'skipped' || f.action === 'unchanged');
    const deleted = result.files.filter((f) => f.action === 'deleted');

    totalSynced += synced.length;
    totalSkipped += skipped.length;
    totalErrors += result.errors?.length || 0;

    if (synced.length > 0) {
      logger.success(`${result.target} (${synced.length} files):`);
      for (const file of synced) {
        const action = file.action === 'created' ? colors.green('+') : colors.yellow('~');
        logger.log(`  ${action} ${colors.dim(file.path)}`);
      }
    }

    if (deleted.length > 0) {
      logger.log(`${result.target} cleaned ${deleted.length} orphan(s)`);
    }

    if (result.errors && result.errors.length > 0) {
      logger.error(`${result.target} errors:`);
      for (const error of result.errors) {
        logger.log(`  ${colors.red('×')} ${error}`);
      }
    }
  }

  logger.blank();

  // Update sync status (only if not dry run and sync was successful)
  if (!options.dryRun && totalSynced > 0) {
    const store = createLocalStore(cwd);
    const stateManager = createStateManager();
    const syncedTargets = results
      .filter((r) => r.files.some((f) => f.action === 'created' || f.action === 'updated'))
      .map((r) => r.target);

    // Update each skill's syncedPlatforms in registry
    for (const skillName of skills.keys()) {
      const entry = await store.getSkillEntry(skillName);
      if (entry) {
        const currentPlatforms = entry.syncedPlatforms || [];
        const newPlatforms = [...new Set([...currentPlatforms, ...syncedTargets])];
        await store.updateSyncedPlatforms(skillName, newPlatforms);
      }
    }

    // Record sync in state (for status command)
    for (const target of syncedTargets) {
      await stateManager.recordSync(cwd, target as SyncTarget);
    }
  }

  // Summary
  logger.log(
    `Summary: ${colors.green(String(totalSynced))} synced, ` +
      `${colors.yellow(String(totalSkipped))} unchanged, ` +
      `${colors.red(String(totalErrors))} errors`
  );
  logger.blank();
}
