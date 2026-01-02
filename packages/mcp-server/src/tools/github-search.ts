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
  'allowed-tools'?: string;
  metadata?: {
    'short-description'?: string;
  };
}

/**
 * Parse markdown frontmatter (YAML between --- markers)
 */
function parseFrontmatter(
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
 * Check if a repository has a SKILL.md file
 */
async function detectSkillMd(
  repoFullName: string
): Promise<{ hasSkill: boolean; skillFile?: string }> {
  // Check common SKILL.md locations
  const paths = [
    'SKILL.md',
    'skill.md',
    'skills/SKILL.md',
    'skills/skill.md',
    '.claude/skills/skill.md',
  ];

  for (const path of paths) {
    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/HEAD/${path}`;

    try {
      const response = await fetch(rawUrl, {
        headers: { 'User-Agent': 'skillpkg-mcp-server' },
      });

      if (!response.ok) continue;

      const content = await response.text();
      const parsed = parseFrontmatter(content);

      // Valid SKILL.md has frontmatter with name
      if (parsed && parsed.frontmatter.name) {
        return { hasSkill: true, skillFile: path };
      }
    } catch {
      continue;
    }
  }

  return { hasSkill: false };
}

/**
 * Search for AI agent skills on GitHub
 */
export async function searchGitHubSkills(
  query: string,
  options: GitHubSearchOptions = {}
): Promise<GitHubSkillResult[]> {
  const limit = options.limit || 20;

  // Build search query
  const searchQuery = buildSearchQuery(query);

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'skillpkg-mcp-server',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

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
      const detection = await detectSkillMd(item.full_name);

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
 * Get skill info from a specific GitHub repository
 */
export async function getGitHubSkillInfo(
  repoFullName: string
): Promise<GitHubSkillResult | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'skillpkg-mcp-server',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      return null;
    }

    const item = (await response.json()) as GitHubRepoSearchItem;
    const detection = await detectSkillMd(item.full_name);

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
export async function fetchSkillContent(
  repoFullName: string,
  skillFile: string
): Promise<{ name: string; description: string; instructions: string } | null> {
  const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/HEAD/${skillFile}`;

  try {
    const response = await fetch(rawUrl, {
      headers: { 'User-Agent': 'skillpkg-mcp-server' },
    });

    if (!response.ok) return null;

    const content = await response.text();
    const parsed = parseFrontmatter(content);

    if (!parsed) return null;

    return {
      name: (parsed.frontmatter.name as string) || '',
      description:
        (parsed.frontmatter.description as string) ||
        parsed.frontmatter.metadata?.['short-description'] ||
        '',
      instructions: parsed.body,
    };
  } catch {
    return null;
  }
}
