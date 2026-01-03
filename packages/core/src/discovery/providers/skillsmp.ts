/**
 * Skillsmp Provider - Primary source (40K+ skills)
 * Requires API key from skillsmp.com
 */
import type {
  DiscoveryProvider,
  DiscoverySearchOptions,
  DiscoveredSkill,
} from '../types.js';

/**
 * Skillsmp API configuration
 */
export const SKILLSMP_CONFIG = {
  baseUrl: 'https://skillsmp.com/api/v1',
  endpoints: {
    search: '/skills/search',
    aiSearch: '/skills/ai-search',
  },
} as const;

/**
 * Skillsmp provider options
 */
export interface SkillsmpProviderOptions {
  /** API key (required) */
  apiKey?: string;
  /** Cache TTL in ms (default: 5 minutes) */
  cacheTtl?: number;
  /** Request timeout in ms (default: 30s) */
  timeout?: number;
}

/**
 * Cached search result
 */
interface CacheEntry {
  data: DiscoveredSkill[];
  expiry: number;
}

/**
 * Provider for skillsmp.com registry (40K+ skills)
 */
export class SkillsmpProvider implements DiscoveryProvider {
  readonly id = 'skillsmp' as const;
  private apiKey: string | null;
  private cacheTtl: number;
  private timeout: number;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(options: SkillsmpProviderOptions = {}) {
    this.apiKey = options.apiKey || null;
    this.cacheTtl = options.cacheTtl || 5 * 60 * 1000; // 5 minutes
    this.timeout = options.timeout || 30000;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Set API key (can be called after construction)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Search skills on skillsmp.com
   */
  async search(options: DiscoverySearchOptions): Promise<DiscoveredSkill[]> {
    if (!this.apiKey) {
      throw new Error(
        'Skillsmp API key not configured. Run: skillpkg config set registries.skillsmp.token YOUR_KEY'
      );
    }

    const { query, limit = 20 } = options;
    const cacheKey = `${query}:${limit}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Build URL
    const url = new URL(
      `${SKILLSMP_CONFIG.baseUrl}${SKILLSMP_CONFIG.endpoints.search}`
    );
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));

    // Fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Skillsmp API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as SkillsmpSearchResponse;
      const skills = this.mapResults(data);

      // Cache results
      this.cache.set(cacheKey, {
        data: skills,
        expiry: Date.now() + this.cacheTtl,
      });

      return skills;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`Skillsmp API timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Map API response to DiscoveredSkill format
   */
  private mapResults(data: SkillsmpSearchResponse): DiscoveredSkill[] {
    return (data.skills || []).map((skill) => ({
      name: skill.name,
      description: skill.description || '',
      source: this.resolveSource(skill),
      provider: this.id,
      stars: skill.stars,
      author: skill.author,
      keywords: skill.keywords,
      lastUpdated: skill.updated_at,
    }));
  }

  /**
   * Resolve installable source from skill data
   */
  private resolveSource(skill: SkillsmpSkill): string {
    // Prefer GitHub URL if available
    if (skill.github_url) {
      const match = skill.github_url.match(
        /github\.com\/([^\/]+\/[^\/]+)(?:\/tree\/[^\/]+\/(.+))?/
      );
      if (match) {
        const [, repo, path] = match;
        return path ? `github:${repo}#${path}` : `github:${repo}`;
      }
    }

    // Fallback to skillsmp reference
    return `skillsmp:${skill.id || skill.name}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Skillsmp API response types
 */
interface SkillsmpSearchResponse {
  skills?: SkillsmpSkill[];
  total?: number;
  page?: number;
  limit?: number;
}

interface SkillsmpSkill {
  id?: string;
  name: string;
  description?: string;
  author?: string;
  stars?: number;
  github_url?: string;
  keywords?: string[];
  updated_at?: string;
}

/**
 * Create a skillsmp provider
 */
export function createSkillsmpProvider(
  options?: SkillsmpProviderOptions
): SkillsmpProvider {
  return new SkillsmpProvider(options);
}
