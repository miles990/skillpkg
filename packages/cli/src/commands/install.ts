/**
 * install command - Install a skill
 *
 * Supports:
 * - Local path: skillpkg install ./path/to/skill
 * - GitHub: skillpkg install github:user/repo or skillpkg install user/repo
 * - Pack file: skillpkg install skill.skillpkg
 */
import { existsSync, createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { createGunzip } from 'zlib';
import {
  parse,
  createGlobalStore,
  createLocalStore,
  detectSkillMd,
  fetchSkillMdContent,
  SKILL_MD_PATHS,
} from 'skillpkg-core';
import type { Skill } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';
import * as tar from 'tar-stream';

interface InstallOptions {
  global?: boolean;
}

/**
 * Parse source string to determine source type
 */
function parseSource(source: string): { type: 'local' | 'github' | 'pack'; value: string } {
  // GitHub: github:user/repo
  if (source.startsWith('github:')) {
    return { type: 'github', value: source.slice(7) };
  }

  // GitHub: user/repo format
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source) && !existsSync(source)) {
    return { type: 'github', value: source };
  }

  // Pack file: *.skillpkg
  if (source.endsWith('.skillpkg')) {
    return { type: 'pack', value: source };
  }

  // Local path
  return { type: 'local', value: source };
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
    const localSkillMdPath = join(process.cwd(), 'SKILL.md');
    if (existsSync(localSkillPath) || existsSync(localSkillMdPath)) {
      skillArg = '.';
    } else {
      logger.error('No skill specified and no skill.yaml/SKILL.md found in current directory');
      logger.log(`Usage: ${colors.cyan('skillpkg install <skill>')}`);
      logger.blank();
      logger.log('Examples:');
      logger.item(`${colors.cyan('skillpkg install ./path/to/skill')} - Install from local path`);
      logger.item(`${colors.cyan('skillpkg install github:user/repo')} - Install from GitHub`);
      logger.item(`${colors.cyan('skillpkg install user/repo')} - Install from GitHub (shorthand)`);
      process.exit(1);
    }
  }

  const { type, value } = parseSource(skillArg);

  switch (type) {
    case 'local':
      await installFromLocal(value, options);
      break;
    case 'github':
      await installFromGitHub(value, options);
      break;
    case 'pack':
      await installFromPack(value, options);
      break;
  }
}

/**
 * Install skill from local path
 */
async function installFromLocal(pathArg: string, options: InstallOptions): Promise<void> {
  // Resolve path
  const skillPath = isAbsolute(pathArg) ? pathArg : resolve(process.cwd(), pathArg);

  // Try to find skill file (SKILL.md or skill.yaml)
  let skillContent: string | null = null;
  let isSkillMd = false;

  // Check for SKILL.md first
  for (const mdPath of ['SKILL.md', 'skill.md']) {
    const fullPath = join(skillPath, mdPath);
    if (existsSync(fullPath)) {
      skillContent = await readFile(fullPath, 'utf-8');
      isSkillMd = true;
      break;
    }
  }

  // Fall back to skill.yaml
  if (!skillContent) {
    const yamlPath = existsSync(join(skillPath, 'skill.yaml'))
      ? join(skillPath, 'skill.yaml')
      : skillPath.endsWith('.yaml')
        ? skillPath
        : join(skillPath, 'skill.yaml');

    if (existsSync(yamlPath)) {
      skillContent = await readFile(yamlPath, 'utf-8');
    }
  }

  if (!skillContent) {
    logger.error(`No SKILL.md or skill.yaml found at ${skillPath}`);
    process.exit(1);
  }

  // Parse skill
  let skill: Skill;
  try {
    if (isSkillMd) {
      skill = parseSkillMd(skillContent);
    } else {
      const result = parse(skillContent);
      if (!result.success || !result.data) {
        logger.error('Failed to parse skill.yaml:');
        result.errors?.forEach((e) => logger.error(`  ${e.message}`));
        process.exit(1);
      }
      skill = result.data;
    }
  } catch (error) {
    logger.error(`Failed to parse skill: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  await installSkill(skill, options, 'local');
}

/**
 * Install skill from GitHub
 */
async function installFromGitHub(repo: string, options: InstallOptions): Promise<void> {
  logger.info(`Installing from GitHub: ${colors.cyan(repo)}`);

  // Detect SKILL.md in the repository
  const detection = await withSpinner('Checking for SKILL.md', async () => {
    return detectSkillMd(repo);
  });

  if (!detection.hasSkill || !detection.skillFile) {
    logger.error(`No SKILL.md found in ${repo}`);
    logger.blank();
    logger.log('Checked locations:');
    SKILL_MD_PATHS.forEach((p) => logger.item(colors.dim(p)));
    logger.blank();
    logger.log(
      colors.dim(
        'Make sure the repository has a SKILL.md file with proper frontmatter (name, description).'
      )
    );
    process.exit(1);
  }

  // Fetch SKILL.md content
  const content = await withSpinner('Fetching SKILL.md', async () => {
    return fetchSkillMdContent(repo, detection.skillFile!);
  });

  if (!content) {
    logger.error('Failed to fetch SKILL.md content');
    process.exit(1);
  }

  // Create skill object
  const skill: Skill = {
    schema: '1.0',
    name: content.name,
    version: content.version,
    description: content.description,
    instructions: content.instructions,
  };

  await installSkill(skill, options, 'import', `github:${repo}`);
}

/**
 * Install skill from .skillpkg pack file
 */
async function installFromPack(packPath: string, options: InstallOptions): Promise<void> {
  // Resolve path
  const fullPath = isAbsolute(packPath) ? packPath : resolve(process.cwd(), packPath);

  if (!existsSync(fullPath)) {
    logger.error(`Pack file not found: ${fullPath}`);
    process.exit(1);
  }

  logger.info(`Installing from ${colors.cyan(packPath)}`);

  // Extract skill.yaml from the pack
  const skill = await withSpinner('Extracting pack', async (): Promise<Skill> => {
    const extract = tar.extract();
    const chunks: Buffer[] = [];

    return new Promise<Skill>((resolvePromise, reject) => {
      extract.on('entry', (header, stream, next) => {
        // skill.yaml can be at root or inside a skill-named folder
        if (header.name === 'skill.yaml' || header.name.endsWith('/skill.yaml')) {
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', next);
        } else {
          stream.resume();
          next();
        }
      });

      extract.on('finish', async () => {
        if (chunks.length === 0) {
          reject(new Error('skill.yaml not found in pack'));
          return;
        }

        const content = Buffer.concat(chunks).toString('utf-8');
        const result = parse(content);

        if (!result.success || !result.data) {
          reject(new Error(`Failed to parse skill.yaml: ${result.errors?.[0]?.message}`));
          return;
        }

        resolvePromise(result.data);
      });

      extract.on('error', reject);

      createReadStream(fullPath).pipe(createGunzip()).pipe(extract);
    });
  });

  await installSkill(skill, options, 'local');
}

/**
 * Parse SKILL.md content to Skill object
 */
function parseSkillMd(content: string): Skill {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid SKILL.md format: missing frontmatter');
  }

  const { parse: parseYaml } = require('yaml');
  const frontmatter = parseYaml(match[1]);

  if (!frontmatter.name) {
    throw new Error('Invalid SKILL.md: missing name in frontmatter');
  }

  return {
    schema: '1.0',
    name: frontmatter.name,
    version: frontmatter.version || '1.0.0',
    description: frontmatter.description || frontmatter.metadata?.['short-description'] || '',
    instructions: match[2],
  };
}

/**
 * Install skill to store
 */
async function installSkill(
  skill: Skill,
  options: InstallOptions,
  source: 'local' | 'import',
  sourceUrl?: string
): Promise<void> {
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
    await store.addSkill(skill, { source, sourceUrl });
  });

  logger.blank();
  logger.success(`Installed ${colors.cyan(skill.name)}@${skill.version}`);
  logger.blank();
  logger.log('Next steps:');
  logger.item(`Run ${colors.cyan('skillpkg list')} to see installed skills`);
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.blank();
}
