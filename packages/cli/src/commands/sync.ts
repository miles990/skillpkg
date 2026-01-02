/**
 * sync command - Sync skills to platforms
 */
import {
  createLocalStore,
  createAdapterManager,
  parse,
} from 'skillpkg-core';
import type { Skill, StoreManager } from 'skillpkg-core';
import { readFile } from 'fs/promises';
import { join } from 'path';
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
  const store = createLocalStore();
  const adapterManager = createAdapterManager();

  // Check if store is initialized
  if (!(await store.isInitialized())) {
    logger.error('No skills installed');
    logger.log(`Run ${colors.cyan('skillpkg install <skill>')} first`);
    process.exit(1);
  }

  // Get skills metadata
  const skillsMeta = await store.listSkills();

  if (skillsMeta.length === 0) {
    logger.info('No skills to sync');
    return;
  }

  // Filter by name if provided
  const targetSkillsMeta = skillName
    ? skillsMeta.filter((s) => s.name === skillName)
    : skillsMeta;

  if (targetSkillsMeta.length === 0) {
    logger.error(`Skill ${colors.cyan(skillName || '')} not found`);
    process.exit(1);
  }

  // Load full skill data
  const skills: Skill[] = [];
  for (const meta of targetSkillsMeta) {
    const skill = await loadSkillContent(meta.name);
    if (skill) {
      skills.push(skill);
    }
  }

  // Parse target platforms
  const platforms = options.target
    ? options.target.split(',').map((p) => p.trim())
    : undefined; // undefined = all platforms

  logger.header('Sync Skills to Platforms');

  // Detect available platforms
  const detected = await adapterManager.detectPlatforms(process.cwd());
  const presentPlatforms = detected.filter((p) => p.detected);

  if (presentPlatforms.length === 0) {
    logger.warn('No AI platforms detected in this project');
    logger.blank();
    logger.log('Supported platforms:');
    for (const adapter of adapterManager.listAdapters()) {
      logger.item(`${colors.cyan(adapter.displayName)} (${adapter.name})`);
    }
    logger.blank();
    logger.log('Create platform directories to enable sync:');
    logger.item(`${colors.dim('.claude/')} for Claude Code`);
    logger.item(`${colors.dim('.codex/')} or ${colors.dim('AGENTS.md')} for Codex`);
    logger.item(`${colors.dim('.github/')} for GitHub Copilot`);
    logger.item(`${colors.dim('.cline/')} for VS Code Cline`);
    logger.blank();
    return;
  }

  logger.log('Detected platforms:');
  for (const platform of presentPlatforms) {
    logger.item(`${colors.green('✓')} ${platform.displayName}`);
  }
  logger.blank();

  if (options.dryRun) {
    logger.warn('Dry run mode - no changes will be made');
    logger.blank();
  }

  logger.log(`Skills to sync: ${colors.cyan(String(skills.length))}`);
  logger.blank();

  // Sync
  const result = await withSpinner(
    'Syncing skills to platforms',
    () =>
      adapterManager.sync(skills, {
        projectPath: process.cwd(),
        platforms,
        dryRun: options.dryRun,
      }),
    {
      successText: 'Sync complete',
      failText: 'Sync failed',
    }
  );

  logger.blank();

  // Show results
  if (result.synced.length > 0) {
    logger.success('Synced:');
    for (const item of result.synced) {
      logger.item(
        `${colors.cyan(item.skill)} → ${colors.green(item.platform)}`
      );
      logger.log(`  ${colors.dim(item.path)}`);
    }
    logger.blank();
  }

  if (result.skipped.length > 0) {
    logger.warn('Skipped:');
    for (const item of result.skipped) {
      logger.item(
        `${colors.cyan(item.skill)} → ${colors.yellow(item.platform)}: ${item.reason}`
      );
    }
    logger.blank();
  }

  if (result.errors.length > 0) {
    logger.error('Errors:');
    for (const item of result.errors) {
      logger.item(
        `${colors.cyan(item.skill)} → ${colors.red(item.platform)}: ${item.error}`
      );
    }
    logger.blank();
  }

  // Update registry with synced platforms
  if (!options.dryRun && result.synced.length > 0) {
    await updateSyncedPlatformsInRegistry(store, result.synced);
  }

  // Summary
  logger.log(
    `Summary: ${colors.green(String(result.synced.length))} synced, ` +
    `${colors.yellow(String(result.skipped.length))} skipped, ` +
    `${colors.red(String(result.errors.length))} errors`
  );
  logger.blank();
}

/**
 * Load skill content from store
 */
async function loadSkillContent(skillName: string): Promise<Skill | null> {
  const skillDir = join(process.cwd(), '.skillpkg', 'skills', skillName);
  const yamlPath = join(skillDir, 'skill.yaml');

  try {
    const content = await readFile(yamlPath, 'utf-8');
    const result = parse(content);
    return result.success && result.data ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Update synced platforms in registry
 */
async function updateSyncedPlatformsInRegistry(
  store: StoreManager,
  synced: Array<{ skill: string; platform: string }>
): Promise<void> {
  // Group by skill
  const bySkill = new Map<string, string[]>();
  for (const item of synced) {
    if (!bySkill.has(item.skill)) {
      bySkill.set(item.skill, []);
    }
    bySkill.get(item.skill)!.push(item.platform);
  }

  // Update each skill's synced platforms
  for (const [skillName, platforms] of bySkill) {
    // Get existing entry to merge platforms
    const entry = await store.getSkillEntry(skillName);
    if (entry) {
      // Merge with existing platforms
      const existingPlatforms = new Set<string>(entry.syncedPlatforms || []);
      for (const p of platforms) {
        existingPlatforms.add(p);
      }

      // Update using store method
      await store.updateSyncedPlatforms(skillName, Array.from(existingPlatforms));
    }
  }
}
