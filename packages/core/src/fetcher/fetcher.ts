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
import type { FetchResult, FetcherOptions, ParsedSource } from './types.js';
import { parseSource, normalizeSource } from './source-parser.js';
import { detectSkillMd } from '../github/search.js';
import type { SkillFetcher, SkillMetadata } from '../resolver/types.js';
import type { SkillFetcherAdapter } from '../installer/types.js';

/**
 * Fetch a skill from any supported source
 */
export async function fetchSkill(
  source: string,
  options: FetcherOptions = {}
): Promise<FetchResult> {
  try {
    const parsed = parseSource(source);
    const skill = await fetchByType(parsed, options);

    if (!skill) {
      return {
        success: false,
        error: `Failed to fetch skill from: ${source}`,
      };
    }

    return {
      success: true,
      skill,
      sourceUrl: normalizeSource(source),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch skill by parsed source type
 */
async function fetchByType(
  parsed: ParsedSource,
  options: FetcherOptions
): Promise<Skill | null> {
  switch (parsed.type) {
    case 'github':
      return fetchFromGitHub(parsed.value, parsed.subpath, options);
    case 'gist':
      return fetchFromGist(parsed.value, options);
    case 'url':
      return fetchFromUrl(parsed.value, options);
    case 'local':
      return fetchFromLocal(parsed.value);
    case 'pack':
      return fetchFromPack(parsed.value);
    default:
      return null;
  }
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
): Promise<Skill | null> {
  const token = options.githubToken || process.env.GITHUB_TOKEN;

  let skillFile: string;

  if (subpath) {
    // Direct subpath provided: use {subpath}/SKILL.md
    skillFile = `${subpath}/SKILL.md`;
  } else {
    // No subpath: detect SKILL.md location in repo root
    const detection = await detectSkillMd(repo, token);
    if (!detection.hasSkill || !detection.skillFile) {
      return null;
    }
    skillFile = detection.skillFile;
  }

  // Fetch raw content
  const rawUrl = `https://raw.githubusercontent.com/${repo}/HEAD/${skillFile}`;
  const headers: Record<string, string> = {
    'User-Agent': 'skillpkg',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      return null;
    }
    const content = await response.text();
    return parseSkillMd(content);
  } catch {
    return null;
  }
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
 * Fetch skill from local path
 */
async function fetchFromLocal(path: string): Promise<Skill | null> {
  const resolvedPath = resolve(path);

  // Check for SKILL.md in directory
  const skillMdPaths = [
    join(resolvedPath, 'SKILL.md'),
    join(resolvedPath, 'skill.md'),
    resolvedPath, // Maybe it's the file itself
  ];

  for (const skillPath of skillMdPaths) {
    if (existsSync(skillPath)) {
      try {
        const fileStat = await stat(skillPath);
        if (fileStat.isDirectory()) {
          continue;
        }
        const content = await readFile(skillPath, 'utf-8');
        return parseSkillMd(content);
      } catch {
        continue;
      }
    }
  }

  return null;
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
    async fetchSkill(source: string): Promise<Skill | null> {
      const result = await fetchSkill(source, options);
      return result.success ? result.skill || null : null;
    },
  };
}
