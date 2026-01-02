/**
 * sync command - Sync skills to platforms
 *
 * Note: Full implementation in M4 (Platform Adapters)
 */
import { createLocalStore } from '@skillpkg/core';
import { logger, colors } from '../ui/index.js';

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

  // Check if store is initialized
  if (!(await store.isInitialized())) {
    logger.error('No skills installed');
    logger.log(`Run ${colors.cyan('skillpkg install <skill>')} first`);
    process.exit(1);
  }

  // Get skills to sync
  const skills = await store.listSkills();

  if (skills.length === 0) {
    logger.info('No skills to sync');
    return;
  }

  // Filter by name if provided
  const targetSkills = skillName
    ? skills.filter((s) => s.name === skillName)
    : skills;

  if (targetSkills.length === 0) {
    logger.error(`Skill ${colors.cyan(skillName || '')} not found`);
    process.exit(1);
  }

  // Parse target platforms
  const platforms = options.target
    ? options.target.split(',').map((p) => p.trim())
    : ['claude-code', 'codex', 'copilot', 'cline'];

  logger.header('Sync Skills to Platforms');

  if (options.dryRun) {
    logger.warn('Dry run mode - no changes will be made');
    logger.blank();
  }

  logger.log(`Skills to sync: ${colors.cyan(String(targetSkills.length))}`);
  logger.log(`Target platforms: ${platforms.map((p) => colors.cyan(p)).join(', ')}`);
  logger.blank();

  // TODO: Implement platform adapters in M4
  logger.warn('Platform sync not yet implemented');
  logger.log('Will be available after M4: Platform Adapters');
  logger.blank();

  logger.log('Planned sync:');
  for (const skill of targetSkills) {
    logger.item(`${colors.cyan(skill.name)} → ${platforms.join(', ')}`);
  }
  logger.blank();
}
