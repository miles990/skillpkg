/**
 * install command - Install a skill
 */
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { parse, createGlobalStore, createLocalStore } from '@skillpkg/core';
import type { Skill } from '@skillpkg/core';
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
  // If no skill argument, try to install from current directory
  if (!skillArg) {
    const localSkillPath = join(process.cwd(), 'skill.yaml');
    if (existsSync(localSkillPath)) {
      skillArg = '.';
    } else {
      logger.error('No skill specified and no skill.yaml found in current directory');
      logger.log(`Usage: ${colors.cyan('skillpkg install <skill>')}`);
      process.exit(1);
    }
  }

  // Determine if it's a local path or registry name
  const isLocalPath = skillArg.startsWith('.') || skillArg.startsWith('/') || existsSync(skillArg);

  if (isLocalPath) {
    await installFromLocal(skillArg, options);
  } else {
    await installFromRegistry(skillArg, options);
  }
}

/**
 * Install skill from local path
 */
async function installFromLocal(pathArg: string, options: InstallOptions): Promise<void> {
  // Resolve path
  const skillPath = isAbsolute(pathArg) ? pathArg : resolve(process.cwd(), pathArg);
  const yamlPath = existsSync(join(skillPath, 'skill.yaml'))
    ? join(skillPath, 'skill.yaml')
    : skillPath.endsWith('.yaml')
      ? skillPath
      : join(skillPath, 'skill.yaml');

  if (!existsSync(yamlPath)) {
    logger.error(`skill.yaml not found at ${yamlPath}`);
    process.exit(1);
  }

  // Parse skill.yaml
  let skill: Skill;
  try {
    const content = await readFile(yamlPath, 'utf-8');
    const result = parse(content);

    if (!result.success || !result.data) {
      logger.error('Failed to parse skill.yaml:');
      result.errors?.forEach((e) => logger.error(`  ${e.message}`));
      process.exit(1);
    }

    skill = result.data;
  } catch (error) {
    logger.error(`Failed to read skill.yaml: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Get store
  const store = options.global ? createGlobalStore() : createLocalStore();

  // Initialize store if needed
  if (!(await store.isInitialized())) {
    await withSpinner('Initializing store', () => store.init());
  }

  // Check if already installed
  if (await store.hasSkill(skill.name)) {
    const existing = await store.getSkill(skill.name);
    if (existing?.version === skill.version) {
      logger.warn(`${skill.name}@${skill.version} is already installed`);
      return;
    }
    logger.info(`Updating ${skill.name} from ${existing?.version} to ${skill.version}`);
  }

  // Install skill
  await withSpinner(`Installing ${colors.cyan(skill.name)}@${skill.version}`, async () => {
    await store.addSkill(skill, { source: 'local' });
  });

  logger.blank();
  logger.success(`Installed ${colors.cyan(skill.name)}@${skill.version}`);
  logger.blank();
  logger.log('Next steps:');
  logger.item(`Run ${colors.cyan('skillpkg list')} to see installed skills`);
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.blank();
}

/**
 * Install skill from registry
 */
async function installFromRegistry(skillName: string, _options: InstallOptions): Promise<void> {
  // Parse name@version
  const [name, version] = skillName.includes('@')
    ? skillName.split('@')
    : [skillName, 'latest'];

  logger.info(`Installing ${colors.cyan(name)}@${version} from registry...`);

  // TODO: Implement registry client in M6
  logger.warn('Registry installation not yet implemented');
  logger.log(`Will be available after M6: Registry Client`);
  logger.blank();
  logger.log('For now, use local installation:');
  logger.item(`${colors.cyan('skillpkg install ./path/to/skill')}`);
  logger.blank();
}
