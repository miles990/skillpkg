/**
 * Unified skill fetcher
 *
 * Fetches skills from various sources (GitHub, Gist, URL, local, pack)
 */
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import matter from 'gray-matter';
import type { Skill } from '../types.js';
import type { FetchResult, FetcherOptions, ParsedSource, SkillFile } from './types.js';
import { parseSource, normalizeSource } from './source-parser.js';
import { detectSkillMd } from '../github/search.js';
import type { SkillFetcher, SkillMetadata } from '../resolver/types.js';
import type { SkillFetcherAdapter, SkillFetchResult } from '../installer/types.js';

/**
 * Fetch a skill from any supported source
 */
export async function fetchSkill(
  source: string,
  options: FetcherOptions = {}
): Promise<FetchResult> {
  try {
    const parsed = parseSource(source);
    const result = await fetchByType(parsed, options);

    if (!result.skill) {
      return {
        success: false,
        errors: [`Failed to fetch skill from: ${source}`],
      };
    }

    return {
      success: true,
      errors: [],
      skill: result.skill,
      files: result.files.length > 0 ? result.files : undefined,
      sourceUrl: normalizeSource(source),
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Fetch result with skill and optional files
 */
interface InternalFetchResult {
  skill: Skill | null;
  files: SkillFile[];
}

/**
 * Fetch skill by parsed source type
 */
async function fetchByType(
  parsed: ParsedSource,
  options: FetcherOptions
): Promise<InternalFetchResult> {
  switch (parsed.type) {
    case 'github':
      return fetchFromGitHub(parsed.value, parsed.subpath, options);
    case 'gist': {
      const skill = await fetchFromGist(parsed.value, options);
      return { skill, files: [] };
    }
    case 'url': {
      const skill = await fetchFromUrl(parsed.value, options);
      return { skill, files: [] };
    }
    case 'local':
      return fetchFromLocal(parsed.value);
    case 'pack': {
      const skill = await fetchFromPack(parsed.value);
      return { skill, files: [] };
    }
    default:
      return { skill: null, files: [] };
  }
}

/**
 * GitHub Contents API response item
 */
interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

/**
 * List all files in a GitHub directory recursively
 */
async function listGitHubDirectory(
  repo: string,
  path: string,
  token?: string
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skillpkg',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return [];
    }

    const items = await response.json() as GitHubContentItem[];
    if (!Array.isArray(items)) {
      return [];
    }

    const files: string[] = [];

    for (const item of items) {
      if (item.type === 'file') {
        // Skip SKILL.md (handled separately) and files > 1MB
        if (item.name.toLowerCase() !== 'skill.md' && (item.size ?? 0) <= 1024 * 1024) {
          files.push(item.path);
        }
      } else if (item.type === 'dir') {
        // Recursively list subdirectories
        const subFiles = await listGitHubDirectory(repo, item.path, token);
        files.push(...subFiles);
      }
    }

    return files;
  } catch {
    return [];
  }
}

/**
 * Download multiple files from GitHub in parallel
 */
async function downloadGitHubFiles(
  repo: string,
  basePath: string,
  filePaths: string[],
  token?: string
): Promise<SkillFile[]> {
  const headers: Record<string, string> = {
    'User-Agent': 'skillpkg',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  // Binary file extensions
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.tar', '.gz', '.7z',
    '.pdf', '.doc', '.docx',
    '.exe', '.dll', '.so', '.dylib',
  ]);

  const isBinary = (path: string): boolean => {
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    return binaryExtensions.has(ext);
  };

  const downloadFile = async (filePath: string): Promise<SkillFile | null> => {
    const rawUrl = `https://raw.githubusercontent.com/${repo}/HEAD/${filePath}`;

    try {
      const response = await fetch(rawUrl, { headers });
      if (!response.ok) {
        return null;
      }

      // Calculate relative path from basePath
      const relativePath = filePath.startsWith(basePath + '/')
        ? filePath.slice(basePath.length + 1)
        : filePath;

      if (isBinary(filePath)) {
        const buffer = await response.arrayBuffer();
        return {
          path: relativePath,
          content: Buffer.from(buffer).toString('base64'),
          binary: true,
        };
      } else {
        const content = await response.text();
        return {
          path: relativePath,
          content,
        };
      }
    } catch {
      return null;
    }
  };

  // Download all files in parallel (max 10 concurrent)
  const results: SkillFile[] = [];
  const batchSize = 10;

  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(downloadFile));
    results.push(...batchResults.filter((f): f is SkillFile => f !== null));
  }

  return results;
}

/**
 * Fetch skill from GitHub repository
 *
 * @param repo - GitHub repo in user/repo format
 * @param subpath - Optional subpath within repo (e.g., 'docs/skills/my-skill')
 * @param options - Fetcher options
 */
async function fetchFromGitHub(
  repo: string,
  subpath: string | undefined,
  options: FetcherOptions
): Promise<{ skill: Skill | null; files: SkillFile[] }> {
  const token = options.githubToken || process.env.GITHUB_TOKEN;

  let skillFile: string;
  let skillDir: string;

  if (subpath) {
    // Direct subpath provided: use {subpath}/SKILL.md
    skillFile = `${subpath}/SKILL.md`;
    skillDir = subpath;
  } else {
    // No subpath: detect SKILL.md location in repo root
    const detection = await detectSkillMd(repo, token);
    if (!detection.hasSkill || !detection.skillFile) {
      return { skill: null, files: [] };
    }
    skillFile = detection.skillFile;
    // Extract directory from skill file path
    skillDir = skillFile.includes('/')
      ? skillFile.substring(0, skillFile.lastIndexOf('/'))
      : '';
  }

  // Fetch SKILL.md content
  const rawUrl = `https://raw.githubusercontent.com/${repo}/HEAD/${skillFile}`;
  const headers: Record<string, string> = {
    'User-Agent': 'skillpkg',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  let skill: Skill | null = null;

  try {
    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      return { skill: null, files: [] };
    }
    const content = await response.text();
    skill = parseSkillMd(content);
  } catch {
    return { skill: null, files: [] };
  }

  if (!skill) {
    return { skill: null, files: [] };
  }

  // Fetch additional files from the skill directory
  let files: SkillFile[] = [];

  if (skillDir) {
    const filePaths = await listGitHubDirectory(repo, skillDir, token);
    if (filePaths.length > 0) {
      files = await downloadGitHubFiles(repo, skillDir, filePaths, token);
    }
  }

  return { skill, files };
}

/**
 * Fetch skill from GitHub Gist
 */
async function fetchFromGist(
  gistId: string,
  options: FetcherOptions
): Promise<Skill | null> {
  const token = options.githubToken || process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skillpkg',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers,
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    files?: Record<string, { filename?: string; content?: string }>;
  };

  // Find SKILL.md file
  const files = data.files || {};
  const skillFile = Object.values(files).find((f) => {
    const filename = f.filename?.toLowerCase() || '';
    return filename === 'skill.md' || filename.endsWith('/skill.md');
  });

  if (!skillFile?.content) {
    return null;
  }

  return parseSkillMd(skillFile.content);
}

/**
 * Fetch skill from URL
 */
async function fetchFromUrl(
  url: string,
  options: FetcherOptions
): Promise<Skill | null> {
  const controller = new AbortController();
  const timeoutId = options.timeout
    ? setTimeout(() => controller.abort(), options.timeout)
    : undefined;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    return parseSkillMd(content);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * List all files in a local directory recursively
 */
async function listLocalDirectory(dirPath: string): Promise<string[]> {
  const { readdir } = await import('fs/promises');

  const files: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isFile()) {
        // Skip SKILL.md (handled separately)
        if (entry.name.toLowerCase() !== 'skill.md') {
          files.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        const subFiles = await listLocalDirectory(fullPath);
        files.push(...subFiles);
      }
    }
  } catch {
    // Ignore errors
  }

  return files;
}

/**
 * Read local files and create SkillFile array
 */
async function readLocalFiles(basePath: string, filePaths: string[]): Promise<SkillFile[]> {
  // Binary file extensions
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.tar', '.gz', '.7z',
    '.pdf', '.doc', '.docx',
    '.exe', '.dll', '.so', '.dylib',
  ]);

  const isBinary = (path: string): boolean => {
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    return binaryExtensions.has(ext);
  };

  const files: SkillFile[] = [];

  for (const filePath of filePaths) {
    try {
      const relativePath = filePath.startsWith(basePath + '/')
        ? filePath.slice(basePath.length + 1)
        : filePath.replace(basePath, '').replace(/^\//, '');

      if (isBinary(filePath)) {
        const content = await readFile(filePath);
        files.push({
          path: relativePath,
          content: content.toString('base64'),
          binary: true,
        });
      } else {
        const content = await readFile(filePath, 'utf-8');
        files.push({
          path: relativePath,
          content,
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return files;
}

/**
 * Fetch skill from local path
 */
async function fetchFromLocal(path: string): Promise<InternalFetchResult> {
  const resolvedPath = resolve(path);

  // Check for SKILL.md in directory
  const skillMdPaths = [
    join(resolvedPath, 'SKILL.md'),
    join(resolvedPath, 'skill.md'),
    resolvedPath, // Maybe it's the file itself
  ];

  let skill: Skill | null = null;
  let skillDir: string = '';

  for (const skillPath of skillMdPaths) {
    if (existsSync(skillPath)) {
      try {
        const fileStat = await stat(skillPath);
        if (fileStat.isDirectory()) {
          continue;
        }
        const content = await readFile(skillPath, 'utf-8');
        skill = parseSkillMd(content);
        if (skill) {
          // Extract directory containing SKILL.md
          skillDir = skillPath.includes('/')
            ? skillPath.substring(0, skillPath.lastIndexOf('/'))
            : resolvedPath;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!skill) {
    return { skill: null, files: [] };
  }

  // Read additional files from the skill directory
  let files: SkillFile[] = [];

  if (skillDir && existsSync(skillDir)) {
    const filePaths = await listLocalDirectory(skillDir);
    if (filePaths.length > 0) {
      files = await readLocalFiles(skillDir, filePaths);
    }
  }

  return { skill, files };
}

/**
 * Fetch skill from .skillpkg pack file
 */
async function fetchFromPack(_packPath: string): Promise<Skill | null> {
  // Pack format is a tarball with SKILL.md inside
  // For now, return null - implement when needed
  // TODO: Implement pack file parsing
  return null;
}

/**
 * Parse SKILL.md content into Skill object
 */
export function parseSkillMd(content: string): Skill | null {
  try {
    const { data, content: body } = matter(content);

    // Validate required fields
    if (!data.name || typeof data.name !== 'string') {
      return null;
    }

    return {
      schema: (data.schema as string) || '1.0',
      name: data.name as string,
      version: (data.version as string) || '1.0.0',
      description: (data.description as string) || '',
      author: data.author as Skill['author'],
      keywords: data.keywords as string[] || data.tags as string[],
      dependencies: data.dependencies as Skill['dependencies'],
      instructions: body.trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch only metadata (for dependency resolution)
 */
export async function fetchMetadata(
  source: string,
  options: FetcherOptions = {}
): Promise<SkillMetadata | null> {
  const result = await fetchSkill(source, options);
  if (!result.success || !result.skill) {
    return null;
  }

  return {
    name: result.skill.name,
    version: result.skill.version,
    dependencies: result.skill.dependencies,
  };
}

/**
 * Create a SkillFetcher adapter for use with DependencyResolver
 */
export function createSkillFetcher(options: FetcherOptions = {}): SkillFetcher {
  return {
    async fetchMetadata(source: string): Promise<SkillMetadata | null> {
      return fetchMetadata(source, options);
    },
    async fetchSkill(source: string): Promise<Skill | null> {
      const result = await fetchSkill(source, options);
      return result.success ? result.skill || null : null;
    },
  };
}

/**
 * Create a SkillFetcherAdapter for use with Installer
 * This is the recommended adapter for full installation workflows
 */
export function createSkillFetcherAdapter(options: FetcherOptions = {}): SkillFetcherAdapter {
  return {
    async fetchMetadata(source: string) {
      const meta = await fetchMetadata(source, options);
      if (!meta) return null;

      return {
        name: meta.name,
        version: meta.version,
        dependencies: meta.dependencies,
      };
    },
    async fetchSkill(source: string): Promise<SkillFetchResult | null> {
      const result = await fetchSkill(source, options);
      if (!result.success || !result.skill) return null;
      return {
        skill: result.skill,
        files: result.files,
      };
    },
  };
}
