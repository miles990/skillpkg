/**
 * Local Provider - searches installed skills
 * Reuses existing StoreManager
 */
import type { StoreManager, SkillMeta } from '../../store/manager.js';
import type {
  DiscoveryProvider,
  DiscoverySearchOptions,
  DiscoveredSkill,
} from '../types.js';

/**
 * Local provider options
 */
export interface LocalProviderOptions {
  /** Store manager instance (local or global) */
  storeManager: StoreManager;
}

/**
 * Provider for searching locally installed skills
 */
export class LocalProvider implements DiscoveryProvider {
  readonly id = 'local' as const;
  private store: StoreManager;

  constructor(options: LocalProviderOptions) {
    this.store = options.storeManager;
  }

  /**
   * Local provider is always configured
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Search installed skills by name/description
   */
  async search(options: DiscoverySearchOptions): Promise<DiscoveredSkill[]> {
    const { query, limit = 20 } = options;
    const queryLower = query.toLowerCase();

    // Get all installed skills
    const installed = await this.store.listSkills();

    // Filter by query
    const matched = installed.filter(
      (skill) =>
        skill.name.toLowerCase().includes(queryLower) ||
        skill.description?.toLowerCase().includes(queryLower)
    );

    // Convert to DiscoveredSkill format
    const results: DiscoveredSkill[] = matched.map((skill) =>
      this.toDiscoveredSkill(skill)
    );

    // Sort by relevance (name match first)
    results.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(queryLower);
      const bNameMatch = b.name.toLowerCase().includes(queryLower);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return a.name.localeCompare(b.name);
    });

    return results.slice(0, limit);
  }

  /**
   * Convert SkillMeta to DiscoveredSkill
   */
  private toDiscoveredSkill(meta: SkillMeta): DiscoveredSkill {
    return {
      name: meta.name,
      description: meta.description,
      source: `local:${meta.name}`,
      provider: this.id,
      author: meta.author,
      lastUpdated: meta.installedAt,
    };
  }
}

/**
 * Create a local provider
 */
export function createLocalProvider(
  options: LocalProviderOptions
): LocalProvider {
  return new LocalProvider(options);
}
