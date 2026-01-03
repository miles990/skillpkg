/**
 * Awesome Provider - Fallback source (curated awesome repos)
 * No API key required, fetches from known GitHub repos
 */
import type {
  DiscoveryProvider,
  DiscoverySearchOptions,
  DiscoveredSkill,
} from '../types.js';

/**
 * Known awesome repos containing curated skills
 */
export const AWESOME_REPOS = [
  'anthropics/skills', // Official examples
  'ComposioHQ/awesome-claude-skills', // Community curated
] as const;

/**
 * Awesome provider options
 */
export interface AwesomeProviderOptions {
  /** GitHub token (optional, for higher rate limits) */
  githubToken?: string;
  /** Cache TTL in ms (default: 30 minutes) */
  cacheTtl?: number;
  /** Request timeout in ms (default: 30s) */
  timeout?: number;
}

/**
 * Cached repo contents
 */
interface CacheEntry {
  skills: DiscoveredSkill[];
  expiry: number;
}

/**
 * GitHub contents API item
 */
interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
}

/**
 * Provider for awesome repos (curated skill collections)
 */
export class AwesomeProvider implements DiscoveryProvider {
  readonly id = 'awesome' as const;
  private githubToken: string | null;
  private cacheTtl: number;
  private timeout: number;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(options: AwesomeProviderOptions = {}) {
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || null;
    this.cacheTtl = options.cacheTtl || 30 * 60 * 1000; // 30 minutes
    this.timeout = options.timeout || 30000;
  }

  /**
   * Awesome provider is always configured (no API key required)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Search skills in awesome repos
   */
  async search(options: DiscoverySearchOptions): Promise<DiscoveredSkill[]> {
    const { query, limit = 20 } = options;
    const queryLower = query.toLowerCase();

    // Collect skills from all repos
    const allSkills: DiscoveredSkill[] = [];

    for (const repo of AWESOME_REPOS) {
      try {
        const skills = await this.fetchSkillsFromRepo(repo);
        allSkills.push(...skills);
      } catch (error) {
        // Log but continue with other repos
        console.warn(`Failed to fetch from ${repo}:`, (error as Error).message);
      }
    }

    // Filter by query
    const matched = allSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(queryLower) ||
        skill.description.toLowerCase().includes(queryLower) ||
        skill.keywords?.some((k) => k.toLowerCase().includes(queryLower))
    );

    // Sort by relevance (name match first)
    matched.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(queryLower);
      const bNameMatch = b.name.toLowerCase().includes(queryLower);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return (b.stars || 0) - (a.stars || 0);
    });

    return matched.slice(0, limit);
  }

  /**
   * Fetch skills from a single awesome repo
   */
  private async fetchSkillsFromRepo(repo: string): Promise<DiscoveredSkill[]> {
    // Check cache
    const cached = this.cache.get(repo);
    if (cached && cached.expiry > Date.now()) {
      return cached.skills;
    }

    const skills: DiscoveredSkill[] = [];
    const contents = await this.fetchRepoContents(repo, '');

    // Look for directories that might contain SKILL.md
    for (const item of contents) {
      if (item.type === 'dir') {
        const hasSkill = await this.checkHasSkillMd(repo, item.path);
        if (hasSkill) {
          const metadata = await this.fetchSkillMetadata(repo, item.path);
          skills.push({
            name: metadata?.name || item.name,
            description: metadata?.description || '',
            source: `github:${repo}#${item.path}`,
            provider: this.id,
            author: metadata?.author,
            foundIn: [repo],
          });
        }
      }
    }

    // Also check root level SKILL.md
    const rootHasSkill = await this.checkHasSkillMd(repo, '');
    if (rootHasSkill) {
      const metadata = await this.fetchSkillMetadata(repo, '');
      skills.push({
        name: metadata?.name || repo.split('/')[1],
        description: metadata?.description || '',
        source: `github:${repo}`,
        provider: this.id,
        author: metadata?.author,
        foundIn: [repo],
      });
    }

    // Cache results
    this.cache.set(repo, {
      skills,
      expiry: Date.now() + this.cacheTtl,
    });

    return skills;
  }

  /**
   * Fetch repo contents from GitHub API
   */
  private async fetchRepoContents(
    repo: string,
    path: string
  ): Promise<GitHubContentItem[]> {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Check if a path has SKILL.md
   */
  private async checkHasSkillMd(repo: string, path: string): Promise<boolean> {
    const skillPath = path ? `${path}/SKILL.md` : 'SKILL.md';
    const url = `https://raw.githubusercontent.com/${repo}/HEAD/${skillPath}`;

    try {
      const response = await this.fetchWithTimeout(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch and parse SKILL.md metadata
   */
  private async fetchSkillMetadata(
    repo: string,
    path: string
  ): Promise<{ name?: string; description?: string; author?: string } | null> {
    const skillPath = path ? `${path}/SKILL.md` : 'SKILL.md';
    const url = `https://raw.githubusercontent.com/${repo}/HEAD/${skillPath}`;

    try {
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return null;

      const content = await response.text();
      return this.parseSkillFrontmatter(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse SKILL.md frontmatter (simplified)
   */
  private parseSkillFrontmatter(
    content: string
  ): { name?: string; description?: string; author?: string } | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    const yaml = match[1];
    const result: { name?: string; description?: string; author?: string } = {};

    // Simple regex parsing (avoid yaml dependency here)
    const nameMatch = yaml.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim();

    const descMatch = yaml.match(/^description:\s*(.+)$/m);
    if (descMatch) result.description = descMatch[1].trim();

    const authorMatch = yaml.match(/^author:\s*(.+)$/m);
    if (authorMatch) result.author = authorMatch[1].trim();

    return result;
  }

  /**
   * Fetch with timeout and auth headers
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'User-Agent': 'skillpkg',
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create an awesome provider
 */
export function createAwesomeProvider(
  options?: AwesomeProviderOptions
): AwesomeProvider {
  return new AwesomeProvider(options);
}
