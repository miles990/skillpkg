/**
 * GitHub-based skill search
 *
 * Uses GitHub API to find AI agent skills in SKILL.md format.
 * SKILL.md is the industry standard used by Claude Code and OpenAI Codex.
 */

import { parse as parseYaml } from 'yaml';

export interface GitHubSkillResult {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  language: string | null;
  topics: string[];
  updatedAt: string;
  // Skill detection
  hasSkill: boolean;
  skillFile?: string;
  installSource?: string;
}

export interface GitHubSearchOptions {
  limit?: number;
  token?: string;
}

interface GitHubRepoSearchItem {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
}

interface GitHubRepoSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepoSearchItem[];
}

interface SkillMdFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  'allowed-tools'?: string;
  metadata?: {
    'short-description'?: string;
  };
}

/**
 * Parse markdown frontmatter (YAML between --- markers)
 */
export function parseSkillMdFrontmatter(
  content: string
): { frontmatter: SkillMdFrontmatter; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  try {
    const frontmatter = parseYaml(match[1]) as SkillMdFrontmatter;
    return { frontmatter, body: match[2] };
  } catch {
    return null;
  }
}

/**
 * Common SKILL.md file locations
 */
export const SKILL_MD_PATHS = [
  'SKILL.md',
  'skill.md',
  'skills/SKILL.md',
  'skills/skill.md',
  '.claude/skills/skill.md',
];

/**
 * Check if a repository has a SKILL.md file
 */
export async function detectSkillMd(
  repoFullName: string,
  token?: string
): Promise<{ hasSkill: boolean; skillFile?: string; content?: string }> {
  for (const path of SKILL_MD_PATHS) {
    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/HEAD/${path}`;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'skillpkg',
      };
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const response = await fetch(rawUrl, { headers });

      if (!response.ok) continue;

      const content = await response.text();
      const parsed = parseSkillMdFrontmatter(content);

      // Valid SKILL.md has frontmatter with name
      if (parsed && parsed.frontmatter.name) {
        return { hasSkill: true, skillFile: path, content };
      }
    } catch {
      continue;
    }
  }

  return { hasSkill: false };
}

/**
 * Build an optimized search query for AI agent skills
 */
function buildSearchQuery(userQuery: string): string {
  const queryLower = userQuery.toLowerCase();

  // If user already included skill-related terms, use as-is
  const skillTerms = ['skill', 'agent', 'prompt', 'ai', 'llm', 'claude', 'gpt', 'mcp'];
  const hasSkillTerm = skillTerms.some((term) => queryLower.includes(term));

  if (hasSkillTerm) {
    return userQuery;
  }

  // Add context for better AI skill results
  return `${userQuery} skill OR agent OR prompt`;
}

/**
 * Search for AI agent skills on GitHub
 */
export async function searchGitHubSkills(
  query: string,
  options: GitHubSearchOptions = {}
): Promise<GitHubSkillResult[]> {
  const limit = options.limit || 20;
  const token = options.token || process.env.GITHUB_TOKEN;

  // Build search query
  const searchQuery = buildSearchQuery(query);

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${limit}`;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'skillpkg',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          'GitHub API rate limit exceeded. Set GITHUB_TOKEN env var for higher limits.'
        );
      }
      if (response.status === 422) {
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRepoSearchResponse;
    const results: GitHubSkillResult[] = [];

    for (const item of data.items) {
      const detection = await detectSkillMd(item.full_name, token);

      results.push({
        name: item.name,
        fullName: item.full_name,
        description: item.description || '',
        url: item.html_url,
        stars: item.stargazers_count,
        language: item.language,
        topics: item.topics || [],
        updatedAt: item.updated_at,
        hasSkill: detection.hasSkill,
        skillFile: detection.skillFile,
        installSource: detection.hasSkill ? `github:${item.full_name}` : undefined,
      });
    }

    // Sort: skills with SKILL.md first, then by stars
    results.sort((a, b) => {
      if (a.hasSkill && !b.hasSkill) return -1;
      if (!a.hasSkill && b.hasSkill) return 1;
      return b.stars - a.stars;
    });

    return results;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`GitHub search failed: ${String(error)}`);
  }
}

/**
 * Get skill info from a specific GitHub repository
 */
export async function getGitHubSkillInfo(
  repoFullName: string,
  token?: string
): Promise<GitHubSkillResult | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'skillpkg',
    };
    if (token || process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${token || process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });

    if (!response.ok) {
      return null;
    }

    const item = (await response.json()) as GitHubRepoSearchItem;
    const detection = await detectSkillMd(item.full_name, token);

    return {
      name: item.name,
      fullName: item.full_name,
      description: item.description || '',
      url: item.html_url,
      stars: item.stargazers_count,
      language: item.language,
      topics: item.topics || [],
      updatedAt: item.updated_at,
      hasSkill: detection.hasSkill,
      skillFile: detection.skillFile,
      installSource: detection.hasSkill ? `github:${item.full_name}` : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch and parse SKILL.md content from a repository
 */
export async function fetchSkillMdContent(
  repoFullName: string,
  skillFile: string,
  token?: string
): Promise<{ name: string; description: string; version: string; instructions: string } | null> {
  const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/HEAD/${skillFile}`;

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'skillpkg',
    };
    if (token || process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${token || process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(rawUrl, { headers });

    if (!response.ok) return null;

    const content = await response.text();
    const parsed = parseSkillMdFrontmatter(content);

    if (!parsed) return null;

    return {
      name: parsed.frontmatter.name || '',
      description:
        parsed.frontmatter.description ||
        parsed.frontmatter.metadata?.['short-description'] ||
        '',
      version: parsed.frontmatter.version || '1.0.0',
      instructions: parsed.body,
    };
  } catch {
    return null;
  }
}
