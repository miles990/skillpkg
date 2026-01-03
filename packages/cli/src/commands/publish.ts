/**
 * publish command - Publish a skill to the registry
 */
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import matter from 'gray-matter';
import {
  createRegistryClient,
  createExporter,
  isAuthenticated,
  RegistryError,
  DEFAULT_REGISTRY_URL,
} from 'skillpkg-core';
import type { Skill, PublishOptions } from 'skillpkg-core';
import { logger, colors, withSpinner, confirm } from '../ui/index.js';

interface PublishCommandOptions {
  tag?: string;
  access?: string;
  registry?: string;
  dryRun?: boolean;
}

/**
 * publish command handler
 */
export async function publishCommand(options: PublishCommandOptions): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;

  logger.header('Publish Skill');

  // Check authentication
  if (!(await isAuthenticated(registryUrl))) {
    logger.error('Not logged in');
    logger.log(`Run ${colors.cyan('skillpkg login')} first`);
    process.exit(1);
  }

  // Find SKILL.md
  const skillPath = resolve(process.cwd(), 'SKILL.md');
  if (!existsSync(skillPath)) {
    logger.error('No SKILL.md found in current directory');
    logger.log(`Run ${colors.cyan('skillpkg new <name>')} to create one`);
    process.exit(1);
  }

  // Parse SKILL.md
  let skill: Skill;
  try {
    const content = await readFile(skillPath, 'utf-8');
    const { data, content: body } = matter(content);

    if (!data.name) {
      logger.error('Failed to parse SKILL.md: missing name in frontmatter');
      process.exit(1);
    }

    skill = {
      schema: '1.0',
      name: data.name as string,
      version: (data.version as string) || '1.0.0',
      description: (data.description as string) || '',
      instructions: body.trim(),
    };
  } catch (error) {
    logger.error(`Failed to read SKILL.md: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Validate required fields
  const errors = validateForPublish(skill);
  if (errors.length > 0) {
    logger.error('Skill validation failed:');
    errors.forEach((e) => logger.error(`  • ${e}`));
    process.exit(1);
  }

  logger.log(`Publishing ${colors.cyan(skill.name)}@${colors.cyan(skill.version)}`);
  if (skill.description) {
    logger.log(colors.dim(skill.description));
  }
  logger.blank();

  // Dry run mode
  if (options.dryRun) {
    logger.info('Dry run mode - not actually publishing');
    logger.blank();
    logger.log('Would publish:');
    logger.log(`  Name:    ${skill.name}`);
    logger.log(`  Version: ${skill.version}`);
    logger.log(`  Tag:     ${options.tag || 'latest'}`);
    logger.log(`  Access:  ${options.access || 'public'}`);
    return;
  }

  // Confirm publish
  const shouldPublish = await confirm(
    `Publish ${skill.name}@${skill.version} to ${registryUrl}?`,
    true
  );

  if (!shouldPublish) {
    logger.info('Publish cancelled');
    return;
  }

  // Create tarball
  const exporter = createExporter();
  let tarball: Buffer;

  try {
    tarball = await withSpinner('Creating package', async () => {
      const result = await exporter.export(skill, { format: 'pack' });
      if (!result.success) {
        throw new Error(result.error || 'Failed to create package');
      }
      // Read the tarball from disk
      const tarballPath = result.outputPath;
      return readFile(tarballPath);
    });
  } catch (error) {
    logger.error(`Failed to create package: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Publish to registry
  const client = createRegistryClient({ registryUrl });
  const publishOptions: PublishOptions = {};

  if (options.tag) {
    publishOptions.tag = options.tag;
  }
  if (options.access) {
    publishOptions.access = options.access as 'public' | 'restricted';
  }

  try {
    const result = await withSpinner('Publishing to registry', () =>
      client.publish(tarball, publishOptions)
    );

    logger.blank();
    logger.success(`Published ${colors.cyan(skill.name)}@${colors.cyan(skill.version)}`);
    logger.blank();
    logger.log(`View at: ${colors.cyan(result.url)}`);
    logger.blank();
    logger.log('Install with:');
    logger.log(`  ${colors.cyan(`skillpkg install ${skill.name}`)}`);
    logger.blank();
  } catch (error) {
    if (error instanceof RegistryError) {
      switch (error.code) {
        case 'AUTH_REQUIRED':
          logger.error('Authentication required');
          logger.log(`Run ${colors.cyan('skillpkg login')} first`);
          break;
        case 'VERSION_EXISTS':
          logger.error(`Version ${skill.version} already exists`);
          logger.log('Update the version in SKILL.md and try again');
          break;
        case 'AUTH_FAILED':
          logger.error('Permission denied');
          logger.log('You may not have permission to publish this skill');
          break;
        default:
          logger.error(`Publish failed: ${error.message}`);
      }
    } else {
      logger.error(`Publish failed: ${error instanceof Error ? error.message : error}`);
    }
    process.exit(1);
  }
}

/**
 * Validate skill for publishing
 */
function validateForPublish(skill: Skill): string[] {
  const errors: string[] = [];

  if (!skill.name) {
    errors.push('name is required');
  } else if (!/^[a-z0-9-]+$/.test(skill.name)) {
    errors.push('name must be lowercase alphanumeric with hyphens only');
  }

  if (!skill.version) {
    errors.push('version is required');
  } else if (!/^\d+\.\d+\.\d+/.test(skill.version)) {
    errors.push('version must be a valid semver (e.g., 1.0.0)');
  }

  if (!skill.description) {
    errors.push('description is recommended for publishing');
  }

  if (!skill.instructions || skill.instructions.trim() === '') {
    errors.push('instructions are required');
  }

  return errors;
}
