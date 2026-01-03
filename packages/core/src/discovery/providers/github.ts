/**
 * GitHub Provider - Supplementary search (repo-level SKILL.md detection)
 * Wraps existing github/search.ts functionality
 */
import {
  searchGitHubSkills,
  type GitHubSkillResult,
} from '../../github/search.js';
import type {
  DiscoveryProvider,
  DiscoverySearchOptions,
  DiscoveredSkill,
} from '../types.js';

/**
 * GitHub provider options
 */
export interface GitHubProviderOptions {
  /** GitHub token (optional, for higher rate limits) */
  githubToken?: string;
  /** Cache TTL in ms (default: 5 minutes) */
  cacheTtl?: number;
}

/**
 * Cached search result
 */
interface CacheEntry {
  data: DiscoveredSkill[];
  expiry: number;
}

/**
 * Provider for GitHub repository search (supplementary source)
 *
 * Uses topic-based search + SKILL.md detection.
 * Good for finding new/trending skills not yet in registries.
 */
export class GitHubProvider implements DiscoveryProvider {
  readonly id = 'github' as const;
  private githubToken: string | null;
  private cacheTtl: number;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(options: GitHubProviderOptions = {}) {
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || null;
    this.cacheTtl = options.cacheTtl || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * GitHub provider is always configured (token optional, just affects rate limits)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Search skills on GitHub
   */
  async search(options: DiscoverySearchOptions): Promise<DiscoveredSkill[]> {
    const { query, limit = 20 } = options;
    const cacheKey = `${query}:${limit}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Use existing searchGitHubSkills function
    const results = await searchGitHubSkills(query, {
      limit: limit * 2, // Fetch more since we filter to hasSkill only
      token: this.githubToken || undefined,
    });

    // Convert to DiscoveredSkill format, only include repos with SKILL.md
    const skills = results
      .filter((r) => r.hasSkill && r.installSource)
      .slice(0, limit)
      .map((r) => this.toDiscoveredSkill(r));

    // Cache results
    this.cache.set(cacheKey, {
      data: skills,
      expiry: Date.now() + this.cacheTtl,
    });

    return skills;
  }

  /**
   * Convert GitHubSkillResult to DiscoveredSkill
   */
  private toDiscoveredSkill(result: GitHubSkillResult): DiscoveredSkill {
    return {
      name: result.name,
      description: result.description,
      source: result.installSource!, // We filter for hasSkill, so this exists
      provider: this.id,
      stars: result.stars,
      lastUpdated: result.updatedAt,
      keywords: result.topics,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a GitHub provider
 */
export function createGitHubProvider(
  options?: GitHubProviderOptions
): GitHubProvider {
  return new GitHubProvider(options);
}
