/**
 * new command - Create a new skill (SKILL.md)
 */
import inquirer from 'inquirer';
import { SkillCreator } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface NewOptions {
  interactive?: boolean;
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
 * Validate skill name
 */
function validateName(value: string): boolean | string {
  if (!value) {
    return 'Name is required';
  }

  const normalized = toKebabCase(value);
  if (normalized.length < 2) {
    return 'Name must be at least 2 characters';
  }

  if (normalized.length > 100) {
    return 'Name must be less than 100 characters';
  }

  return true;
}

/**
 * new command handler
 */
export async function newCommand(name: string | undefined, options: NewOptions): Promise<void> {
  const creator = new SkillCreator();

  let skillName: string;
  let description: string | undefined;

  if (options.interactive || !name) {
    // Interactive mode
    logger.header('Create a new skill');
    logger.blank();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Skill name:',
        default: name,
        validate: validateName,
        filter: toKebabCase,
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: 'A helpful skill',
      },
    ]);

    skillName = answers.name;
    description = answers.description;
  } else {
    // Quick mode
    const validation = validateName(name);
    if (typeof validation === 'string') {
      logger.error(validation);
      process.exit(1);
    }
    skillName = toKebabCase(name);
  }

  // Check if creating in current directory or new directory
  const createDir = !!skillName;

  // Create the skill
  await withSpinner(`Creating ${skillName}/SKILL.md`, async () => {
    await creator.create({
      name: skillName,
      description,
      createDir,
    });
  });

  logger.blank();
  logger.success(`Created ${colors.cyan(`${skillName}/SKILL.md`)}`);
  logger.blank();

  // Next steps
  logger.log('Next steps:');
  logger.item(`${colors.cyan(`cd ${skillName}`)}`);
  logger.item('Edit SKILL.md with your instructions');
  logger.item(`${colors.cyan('skillpkg install .')} to install locally`);
  logger.blank();
}
