/**
 * Discovery Manager - Multi-source skill discovery with deduplication
 */
import type { StoreManager } from '../store/store-manager.js';
import type {
  DiscoveryProvider,
  DiscoverySource,
  DiscoverySearchOptions,
  DiscoveryResult,
  DiscoveredSkill,
  DiscoveryManagerOptions,
} from './types.js';
import {
  LocalProvider,
  SkillsmpProvider,
  AwesomeProvider,
  GitHubProvider,
  PriorityProvider,
} from './providers/index.js';

/**
 * Discovery manager for multi-source skill search
 */
export class DiscoveryManager {
  private providers: Map<DiscoverySource, DiscoveryProvider> = new Map();
  private skillsmpApiKey: string | null;
  private githubToken: string | null;

  constructor(options: DiscoveryManagerOptions = {}) {
    this.skillsmpApiKey = options.skillsmpApiKey || null;
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || null;

    // Priority provider (first search source - user-defined repos)
    this.providers.set(
      'priority',
      new PriorityProvider({
        githubToken: this.githubToken || undefined,
        priorityRepos: options.priorityRepos,
      })
    );

    // Initialize providers
    if (options.storeManager) {
      this.providers.set(
        'local',
        new LocalProvider({
          storeManager: options.storeManager as StoreManager,
        })
      );
    }

    // Skillsmp provider (primary when API key available)
    const skillsmpProvider = new SkillsmpProvider({
      apiKey: this.skillsmpApiKey || undefined,
    });
    if (this.skillsmpApiKey) {
      skillsmpProvider.setApiKey(this.skillsmpApiKey);
    }
    this.providers.set('skillsmp', skillsmpProvider);

    // Awesome provider (fallback, no key required)
    this.providers.set(
      'awesome',
      new AwesomeProvider({
        githubToken: this.githubToken || undefined,
      })
    );

    // GitHub provider (supplementary)
    this.providers.set(
      'github',
      new GitHubProvider({
        githubToken: this.githubToken || undefined,
      })
    );
  }

  /**
   * Get default sources based on configuration
   *
   * Search order: priority → local → skillsmp/awesome → github
   *
   * With skillsmp key:  priority → local → skillsmp (40K+) → github
   * Without key:        priority → local → awesome (~30) → github
   */
  getDefaultSources(): DiscoverySource[] {
    const sources: DiscoverySource[] = [];

    // Priority repos first (miles990/claude-software-skills, claude-domain-skills)
    if (this.providers.has('priority')) {
      const priorityProvider = this.providers.get('priority') as PriorityProvider;
      if (priorityProvider.isConfigured()) {
        sources.push('priority');
      }
    }

    // Always include local if available
    if (this.providers.has('local')) {
      sources.push('local');
    }

    // Primary source based on API key availability
    if (this.skillsmpApiKey) {
      sources.push('skillsmp');
    } else {
      sources.push('awesome');
    }

    // Always include github as supplementary
    sources.push('github');

    return sources;
  }

  /**
   * Check which sources are configured
   */
  getConfiguredSources(): DiscoverySource[] {
    return Array.from(this.providers.entries())
      .filter(([, provider]) => provider.isConfigured())
      .map(([source]) => source);
  }

  /**
   * Set skillsmp API key (can be called after construction)
   */
  setSkillsmpApiKey(apiKey: string): void {
    this.skillsmpApiKey = apiKey;
    const provider = this.providers.get('skillsmp') as SkillsmpProvider;
    if (provider) {
      provider.setApiKey(apiKey);
    }
  }

  /**
   * Search for skills across multiple sources
   */
  async search(options: DiscoverySearchOptions): Promise<DiscoveryResult> {
    const { query, limit = 20, sources } = options;
    const sourcesToQuery = sources || this.getDefaultSources();

    const allSkills: DiscoveredSkill[] = [];
    const errors: Record<string, string> = {};
    const sourcesQueried: DiscoverySource[] = [];

    // Query each source in parallel
    const promises = sourcesToQuery.map(async (source) => {
      const provider = this.providers.get(source);
      if (!provider) {
        errors[source] = `Provider not found: ${source}`;
        return [];
      }

      if (!provider.isConfigured()) {
        errors[source] = `Provider not configured: ${source}`;
        return [];
      }

      try {
        sourcesQueried.push(source);
        const skills = await provider.search({ query, limit: limit * 2 }); // Fetch more for dedup
        return skills;
      } catch (error) {
        errors[source] = (error as Error).message;
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const skills of results) {
      allSkills.push(...skills);
    }

    // Deduplicate
    const { skills: dedupedSkills, duplicatesRemoved } =
      this.deduplicateSkills(allSkills);

    return {
      skills: dedupedSkills.slice(0, limit),
      sourcesQueried,
      duplicatesRemoved,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  }

  /**
   * Deduplicate skills by normalized source URL
   *
   * Same skill from multiple sources → merge foundIn, keep first occurrence
   */
  private deduplicateSkills(skills: DiscoveredSkill[]): {
    skills: DiscoveredSkill[];
    duplicatesRemoved: number;
  } {
    const seen = new Map<string, DiscoveredSkill>();
    let duplicatesRemoved = 0;

    for (const skill of skills) {
      const key = this.normalizeSourceForDedup(skill.source);

      if (seen.has(key)) {
        // Duplicate found - merge foundIn
        const existing = seen.get(key)!;
        const newFoundIn = skill.foundIn || [skill.provider];

        existing.foundIn = [
          ...new Set([...(existing.foundIn || [existing.provider]), ...newFoundIn]),
        ];

        // Keep higher star count if available
        if (skill.stars && (!existing.stars || skill.stars > existing.stars)) {
          existing.stars = skill.stars;
        }

        duplicatesRemoved++;
      } else {
        // First occurrence
        seen.set(key, {
          ...skill,
          foundIn: skill.foundIn || [skill.provider],
        });
      }
    }

    // Sort by: name match relevance (assumed), then stars, then name
    const result = Array.from(seen.values()).sort((a, b) => {
      // Stars (higher first)
      if (a.stars && b.stars) {
        if (a.stars !== b.stars) return b.stars - a.stars;
      }
      if (a.stars && !b.stars) return -1;
      if (!a.stars && b.stars) return 1;

      // Name (alphabetical)
      return a.name.localeCompare(b.name);
    });

    return { skills: result, duplicatesRemoved };
  }

  /**
   * Normalize source URL for deduplication
   *
   * Examples:
   *   github:user/repo#path → github:user/repo#path
   *   skillsmp:skill-name   → skill-name (extract name)
   *   local:skill-name      → skill-name
   */
  private normalizeSourceForDedup(source: string): string {
    // GitHub source - use as-is (most specific)
    if (source.startsWith('github:')) {
      return source.toLowerCase();
    }

    // Extract name from other sources
    const match = source.match(/^(?:local|skillsmp|awesome):(.+)$/);
    if (match) {
      return match[1].toLowerCase();
    }

    return source.toLowerCase();
  }

  /**
   * Clear all provider caches
   */
  clearAllCaches(): void {
    for (const provider of this.providers.values()) {
      if ('clearCache' in provider && typeof provider.clearCache === 'function') {
        (provider as { clearCache(): void }).clearCache();
      }
    }
  }
}

/**
 * Create a discovery manager
 */
export function createDiscoveryManager(
  options?: DiscoveryManagerOptions
): DiscoveryManager {
  return new DiscoveryManager(options);
}
