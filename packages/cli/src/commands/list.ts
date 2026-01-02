/**
 * list command - List installed skills
 */
import { createGlobalStore, createLocalStore } from 'skillpkg-core';
import type { SkillMeta } from 'skillpkg-core';
import { logger, colors, createTable, printTable } from '../ui/index.js';

interface ListOptions {
  global?: boolean;
  json?: boolean;
}

/**
 * list command handler
 */
export async function listCommand(options: ListOptions): Promise<void> {
  const store = options.global ? createGlobalStore() : createLocalStore();

  // Check if store is initialized
  if (!(await store.isInitialized())) {
    if (options.json) {
      console.log(JSON.stringify({ skills: [] }, null, 2));
    } else {
      logger.info('No skills installed');
      logger.log(`Run ${colors.cyan('skillpkg install <skill>')} to install one`);
    }
    return;
  }

  // Get all skills
  const skills = await store.listSkills();

  if (skills.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ skills: [] }, null, 2));
    } else {
      logger.info('No skills installed');
      logger.log(`Run ${colors.cyan('skillpkg install <skill>')} to install one`);
    }
    return;
  }

  // Output based on format
  if (options.json) {
    console.log(JSON.stringify({ skills }, null, 2));
  } else {
    printSkillTable(skills, options.global);
  }
}

/**
 * Print skills as a table
 */
function printSkillTable(skills: SkillMeta[], isGlobal: boolean = false): void {
  logger.header(`Installed Skills (${isGlobal ? 'global' : 'local'})`);

  const table = createTable({
    head: ['Name', 'Version', 'Description', 'Synced To'],
  });

  for (const skill of skills) {
    const syncedPlatforms =
      skill.syncedPlatforms.length > 0
        ? skill.syncedPlatforms.map((p) => colors.green(p)).join(', ')
        : colors.dim('none');

    table.push([
      colors.cyan(skill.name),
      skill.version,
      truncate(skill.description, 30),
      syncedPlatforms,
    ]);
  }

  printTable(table);
  logger.blank();
  logger.log(`Total: ${colors.cyan(String(skills.length))} skill(s)`);
  logger.blank();
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
