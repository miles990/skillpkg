/**
 * init command - Create a new skill.yaml
 */
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, basename } from 'path';
import inquirer from 'inquirer';
import { stringify } from '@skillpkg/core';
import type { Skill } from '@skillpkg/core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface InitOptions {
  yes?: boolean;
  name?: string;
}

/**
 * Default skill template
 */
function getDefaultSkill(name: string): Skill {
  return {
    schema: '1.0',
    name,
    version: '1.0.0',
    description: 'A skillpkg skill',
    instructions: `# ${name}

## Overview

Describe what this skill does.

## Usage

Explain how to use this skill.

## Examples

Provide usage examples.
`,
  };
}

/**
 * Validate skill name
 */
function validateName(input: string): boolean | string {
  if (!input) {
    return 'Name is required';
  }
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(input)) {
    return 'Name must be kebab-case (e.g., my-skill)';
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
  const skillPath = join(cwd, 'skill.yaml');

  // Check if skill.yaml already exists
  if (existsSync(skillPath)) {
    logger.error('skill.yaml already exists in this directory');
    process.exit(1);
  }

  let skill: Skill;

  if (options.yes) {
    // Quick mode - use defaults
    const defaultName = options.name || toKebabCase(basename(cwd)) || 'my-skill';
    skill = getDefaultSkill(defaultName);
    logger.info(`Creating skill.yaml with defaults (name: ${colors.cyan(defaultName)})`);
  } else {
    // Interactive mode
    logger.header('Create a new skill');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Skill name:',
        default: options.name || toKebabCase(basename(cwd)) || 'my-skill',
        validate: validateName,
      },
      {
        type: 'input',
        name: 'version',
        message: 'Version:',
        default: '1.0.0',
        validate: (input: string) => {
          if (!/^\d+\.\d+\.\d+/.test(input)) {
            return 'Version must be semver (e.g., 1.0.0)';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: 'A skillpkg skill',
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
      },
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Target platforms:',
        choices: [
          { name: 'Claude Code', value: 'claude-code', checked: true },
          { name: 'Codex (OpenAI)', value: 'codex' },
          { name: 'GitHub Copilot', value: 'copilot' },
          { name: 'Cline (VS Code)', value: 'cline' },
        ],
      },
    ]);

    skill = {
      schema: '1.0',
      name: answers.name,
      version: answers.version,
      description: answers.description,
      ...(answers.author && { author: answers.author }),
      ...(answers.platforms?.length > 0 && {
        platforms: Object.fromEntries(answers.platforms.map((p: string) => [p, {}])),
      }),
      instructions: `# ${answers.name}

## Overview

${answers.description}

## Usage

Explain how to use this skill.

## Examples

Provide usage examples.
`,
    };
  }

  // Write skill.yaml
  await withSpinner('Creating skill.yaml', async () => {
    const content = stringify(skill);
    await writeFile(skillPath, content, 'utf-8');
  });

  logger.blank();
  logger.success(`Created ${colors.cyan('skill.yaml')}`);
  logger.blank();
  logger.log('Next steps:');
  logger.item(`Edit ${colors.cyan('skill.yaml')} to customize your skill`);
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.blank();
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
