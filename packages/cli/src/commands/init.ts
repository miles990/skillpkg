/**
 * init command - Initialize a skillpkg project
 *
 * v2.0: Creates skillpkg.json for project configuration
 * For creating skills, use SKILL.md format directly
 */
import { basename } from 'path';
import inquirer from 'inquirer';
import { createConfigManager, type SkillpkgConfig } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface InitOptions {
  yes?: boolean;
  name?: string;
}

/**
 * Get default project name from directory
 */
function getDefaultProjectName(): string {
  const dirName = basename(process.cwd());
  return toKebabCase(dirName) || 'my-project';
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate project name
 */
function validateName(input: string): boolean | string {
  if (!input) {
    return 'Name is required';
  }
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(input) && input.length >= 2) {
    return 'Name must be kebab-case (e.g., my-project)';
  }
  if (input.length < 2 || input.length > 100) {
    return 'Name must be between 2 and 100 characters';
  }
  return true;
}

/**
 * init command handler
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const configManager = createConfigManager();

  // Check if skillpkg.json already exists
  const existingConfig = await configManager.loadProjectConfig(cwd);
  if (existingConfig) {
    logger.error('skillpkg.json already exists in this directory');
    logger.log(`Use ${colors.cyan('skillpkg install <skill>')} to add skills`);
    process.exit(1);
  }

  let config: SkillpkgConfig;

  if (options.yes) {
    // Quick mode - use defaults
    const projectName = options.name || getDefaultProjectName();
    config = {
      $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
      name: projectName,
      skills: {},
      sync_targets: {
        'claude-code': true,
      },
    };
    logger.info(`Creating skillpkg.json with defaults (name: ${colors.cyan(projectName)})`);
  } else {
    // Interactive mode
    logger.header('Initialize skillpkg project');
    logger.blank();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || getDefaultProjectName(),
        validate: validateName,
      },
      {
        type: 'checkbox',
        name: 'syncTargets',
        message: 'Enable sync targets:',
        choices: [
          { name: 'Claude Code (.claude/skills/)', value: 'claude-code', checked: true },
          { name: 'Codex (.codex/skills/)', value: 'codex' },
          { name: 'GitHub Copilot (.github/)', value: 'copilot' },
          { name: 'Cline (.cline/)', value: 'cline' },
        ],
      },
    ]);

    // Build sync_targets object
    const syncTargets: Record<string, boolean> = {};
    for (const target of answers.syncTargets) {
      syncTargets[target] = true;
    }

    config = {
      $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
      name: answers.name,
      skills: {},
      sync_targets: syncTargets,
    };
  }

  // Initialize project
  await withSpinner('Creating skillpkg.json', async () => {
    await configManager.initProject(cwd, config.name);

    // Update with full config (including sync_targets)
    const loaded = await configManager.loadProjectConfig(cwd);
    if (loaded) {
      loaded.sync_targets = config.sync_targets;
      await configManager.saveProjectConfig(cwd, loaded);
    }
  });

  logger.blank();
  logger.success(`Created ${colors.cyan('skillpkg.json')}`);
  logger.blank();

  // Show what was created
  logger.log('Configuration:');
  logger.item(`Name: ${colors.cyan(config.name)}`);
  if (Object.keys(config.sync_targets || {}).length > 0) {
    logger.item(`Sync targets: ${colors.cyan(Object.keys(config.sync_targets || {}).join(', '))}`);
  }
  logger.blank();

  logger.log('Next steps:');
  logger.item(`Run ${colors.cyan('skillpkg install <skill>')} to install skills`);
  logger.item(`Run ${colors.cyan('skillpkg search <query>')} to find skills`);
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.blank();
}
