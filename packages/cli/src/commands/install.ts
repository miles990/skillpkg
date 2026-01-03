/**
 * install command - Install a skill with dependency resolution
 *
 * v2.0: Uses new Installer module with dependency tracking
 *
 * Supports:
 * - Local path: skillpkg install ./path/to/skill
 * - GitHub: skillpkg install github:user/repo or skillpkg install user/repo
 * - Pack file: skillpkg install skill.skillpkg
 */
import { existsSync, createReadStream } from 'fs';
import { resolve, isAbsolute } from 'path';
import { createGunzip } from 'zlib';
import matter from 'gray-matter';
import {
  createInstaller,
  createStateManager,
  createConfigManager,
  createLocalStore,
  createGlobalStore,
  detectSkillMd,
  fetchSkillMdContent,
  readSkill,
  hasSkillMd,
  type Skill,
  type SkillFetcherAdapter,
} from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';
import * as tar from 'tar-stream';

interface InstallOptions {
  global?: boolean;
  registry?: string;
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
  const cwd = process.cwd();

  // If no skill argument, install from skillpkg.json
  if (!skillArg) {
    await installFromConfig(cwd, options);
    return;
  }

  const { type, value } = parseSource(skillArg);
  const source = type === 'github' ? `github:${value}` : value;

  // Create installer with fetcher
  const stateManager = createStateManager();
  const configManager = createConfigManager();
  const storeManager = options.global ? createGlobalStore() : createLocalStore();
  const fetcher = createFetcher();

  // Initialize store if needed
  if (!(await storeManager.isInitialized())) {
    await withSpinner('Initializing store', () => storeManager.init());
  }

  const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

  logger.info(`Installing from ${colors.cyan(skillArg)}`);
  logger.blank();

  // Run installation
  const result = await withSpinner('Resolving dependencies', async () => {
    return installer.install(cwd, source);
  });

  // Show results
  logger.blank();

  if (!result.success) {
    logger.error('Installation failed:');
    for (const error of result.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
    process.exit(1);
  }

  // Show installed skills
  const installed = result.skills.filter((s) => s.action === 'installed');
  const updated = result.skills.filter((s) => s.action === 'updated');
  const skipped = result.skills.filter((s) => s.action === 'skipped');

  if (installed.length > 0) {
    logger.success(`Installed ${installed.length} skill(s):`);
    for (const skill of installed) {
      const transitiveNote = skill.transitive
        ? colors.dim(` (dependency of ${skill.requiredBy})`)
        : '';
      logger.item(`${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}${transitiveNote}`);
    }
  }

  if (updated.length > 0) {
    logger.log(`Updated ${updated.length} skill(s):`);
    for (const skill of updated) {
      logger.item(`${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}`);
    }
  }

  if (skipped.length > 0) {
    logger.log(colors.dim(`Skipped ${skipped.length} already installed skill(s)`));
  }

  // Show MCP requirements
  if (result.mcpRequired.length > 0) {
    logger.blank();
    logger.warn('MCP servers required:');
    for (const mcp of result.mcpRequired) {
      logger.item(`${colors.yellow(mcp)}`);
    }
    logger.log(colors.dim('Configure these in your skillpkg.json or install manually.'));
  }

  logger.blank();
  logger.log('Next steps:');
  logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
  logger.item(`Run ${colors.cyan('skillpkg tree')} to see dependency tree`);
  logger.blank();
}

/**
 * Install all skills from skillpkg.json
 */
async function installFromConfig(cwd: string, options: InstallOptions): Promise<void> {
  const configManager = createConfigManager();
  const config = await configManager.loadProjectConfig(cwd);

  if (!config) {
    logger.error('No skillpkg.json found');
    logger.log(`Run ${colors.cyan('skillpkg init')} to create one`);
    logger.blank();
    logger.log('Or specify a skill to install:');
    logger.item(`${colors.cyan('skillpkg install ./path/to/skill')} - Install from local path`);
    logger.item(`${colors.cyan('skillpkg install github:user/repo')} - Install from GitHub`);
    process.exit(1);
  }

  const skills = Object.keys(config.skills || {});
  if (skills.length === 0) {
    logger.warn('No skills defined in skillpkg.json');
    logger.log(`Add skills using ${colors.cyan('skillpkg install <skill>')}`);
    return;
  }

  logger.info(`Installing ${skills.length} skill(s) from skillpkg.json`);
  logger.blank();

  const stateManager = createStateManager();
  const storeManager = options.global ? createGlobalStore() : createLocalStore();
  const fetcher = createFetcher();

  // Initialize store if needed
  if (!(await storeManager.isInitialized())) {
    await withSpinner('Initializing store', () => storeManager.init());
  }

  const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

  const result = await withSpinner('Installing skills', async () => {
    return installer.installFromConfig(cwd);
  });

  logger.blank();

  if (!result.success) {
    logger.error('Some installations failed:');
    for (const error of result.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
  }

  // Summary
  const installed = result.skills.filter((s) => s.action === 'installed');
  const skipped = result.skills.filter((s) => s.action === 'skipped');

  logger.log(
    `Summary: ${colors.green(String(installed.length))} installed, ` +
      `${colors.dim(String(skipped.length))} skipped`
  );

  if (result.mcpRequired.length > 0) {
    logger.blank();
    logger.warn(`MCP servers required: ${result.mcpRequired.join(', ')}`);
  }

  logger.blank();
}

/**
 * Create a SkillFetcherAdapter for the installer
 */
function createFetcher(): SkillFetcherAdapter {
  return {
    async fetchMetadata(source: string) {
      const skill = await fetchSkillFromSource(source);
      if (!skill) return null;

      return {
        name: skill.name,
        version: skill.version,
        dependencies: skill.dependencies,
      };
    },

    async fetchSkill(source: string) {
      return fetchSkillFromSource(source);
    },
  };
}

/**
 * Fetch skill from various sources
 */
async function fetchSkillFromSource(source: string): Promise<Skill | null> {
  const { type, value } = parseSource(source);

  switch (type) {
    case 'local':
      return fetchFromLocal(value);
    case 'github':
      return fetchFromGitHub(value);
    case 'pack':
      return fetchFromPack(value);
    default:
      return null;
  }
}

/**
 * Fetch skill from local path
 */
async function fetchFromLocal(pathArg: string): Promise<Skill | null> {
  const skillPath = isAbsolute(pathArg) ? pathArg : resolve(process.cwd(), pathArg);

  // Only SKILL.md format is supported
  if (!hasSkillMd(skillPath)) {
    return null;
  }

  try {
    const parsed = await readSkill(skillPath);
    // Convert McpDependency[] to string[] for Skill type compatibility
    const deps = parsed.metadata.dependencies;
    const convertedDeps = deps
      ? {
          mcp: deps.mcp?.map((m) => m.package),
        }
      : undefined;
    return {
      schema: '1.0',
      name: parsed.metadata.name,
      version: parsed.metadata.version,
      description: parsed.metadata.description,
      instructions: parsed.content,
      dependencies: convertedDeps,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch skill from GitHub
 */
async function fetchFromGitHub(repo: string): Promise<Skill | null> {
  const detection = await detectSkillMd(repo);
  if (!detection.hasSkill || !detection.skillFile) return null;

  const content = await fetchSkillMdContent(repo, detection.skillFile);
  if (!content) return null;

  return {
    schema: '1.0',
    name: content.name,
    version: content.version,
    description: content.description,
    instructions: content.instructions,
  };
}

/**
 * Fetch skill from pack file
 */
async function fetchFromPack(packPath: string): Promise<Skill | null> {
  const fullPath = isAbsolute(packPath) ? packPath : resolve(process.cwd(), packPath);
  if (!existsSync(fullPath)) return null;

  const extract = tar.extract();
  const chunks: Buffer[] = [];

  return new Promise<Skill | null>((resolvePromise) => {
    extract.on('entry', (header, stream, next) => {
      // Look for SKILL.md in pack file
      if (header.name === 'SKILL.md' || header.name.endsWith('/SKILL.md')) {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', next);
      } else {
        stream.resume();
        next();
      }
    });

    extract.on('finish', async () => {
      if (chunks.length === 0) {
        resolvePromise(null);
        return;
      }

      // Parse SKILL.md with gray-matter
      const content = Buffer.concat(chunks).toString('utf-8');
      try {
        const { data, content: body } = matter(content);
        resolvePromise({
          schema: '1.0',
          name: (data.name as string) || '',
          version: (data.version as string) || '1.0.0',
          description: (data.description as string) || '',
          instructions: body.trim(),
        });
      } catch {
        resolvePromise(null);
      }
    });

    extract.on('error', () => resolvePromise(null));

    createReadStream(fullPath).pipe(createGunzip()).pipe(extract);
  });
}
