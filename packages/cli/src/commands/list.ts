/**
 * list command - List installed skills with dependency info
 *
 * v2.0: Shows installation source and dependency information
 */
import {
  createGlobalStore,
  createLocalStore,
  createStateManager,
  type SkillMeta,
} from 'skillpkg-core';
import { logger, colors, createTable, printTable } from '../ui/index.js';

interface ListOptions {
  global?: boolean;
  json?: boolean;
}

/**
 * list command handler
 */
export async function listCommand(options: ListOptions): Promise<void> {
  const cwd = process.cwd();
  const store = options.global ? createGlobalStore() : createLocalStore();
  const stateManager = createStateManager();

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

  // Get all skills from store
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

  // Get state for dependency info
  const state = await stateManager.loadState(cwd);

  // Enrich skills with state info
  const enrichedSkills: EnrichedSkillMeta[] = skills.map((skill) => {
    const skillState = state.skills[skill.name];
    return {
      ...skill,
      installedBy: skillState?.installed_by || 'unknown',
      stateSource: skillState?.source || 'unknown',
      hasDependents:
        Object.values(state.skills).some((s) => s.depended_by?.includes(skill.name)) || false,
    };
  });

  // Output based on format
  if (options.json) {
    console.log(JSON.stringify({ skills: enrichedSkills }, null, 2));
  } else {
    printSkillTable(enrichedSkills, options.global);
  }
}

interface EnrichedSkillMeta extends SkillMeta {
  installedBy: string;
  stateSource: string;
  hasDependents: boolean;
}

/**
 * Print skills as a table
 */
function printSkillTable(skills: EnrichedSkillMeta[], isGlobal: boolean = false): void {
  logger.header(`Installed Skills (${isGlobal ? 'global' : 'local'})`);

  const table = createTable({
    head: ['Name', 'Version', 'Type', 'Description'],
  });

  // Sort: user-installed first, then transitive
  const sorted = [...skills].sort((a, b) => {
    if (a.installedBy === 'user' && b.installedBy !== 'user') return -1;
    if (a.installedBy !== 'user' && b.installedBy === 'user') return 1;
    return a.name.localeCompare(b.name);
  });

  for (const skill of sorted) {
    const typeLabel =
      skill.installedBy === 'user'
        ? colors.green('direct')
        : colors.dim(`dep:${skill.installedBy}`);

    const nameWithMarker = skill.hasDependents
      ? `${colors.cyan(skill.name)} ${colors.yellow('◆')}`
      : colors.cyan(skill.name);

    table.push([nameWithMarker, skill.version, typeLabel, truncate(skill.description, 35)]);
  }

  printTable(table);
  logger.blank();

  // Summary
  const userInstalled = skills.filter((s) => s.installedBy === 'user').length;
  const transitive = skills.length - userInstalled;

  logger.log(
    `Total: ${colors.cyan(String(skills.length))} skill(s) ` +
      `(${userInstalled} direct, ${transitive} transitive)`
  );

  // Legend
  if (skills.some((s) => s.hasDependents)) {
    logger.log(colors.dim(`${colors.yellow('◆')} = has dependents`));
  }

  logger.blank();
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
