/**
 * Discovery module types - Multi-source skill discovery
 */

/**
 * Discovery source types
 */
export type DiscoverySource = 'priority' | 'local' | 'skillsmp' | 'awesome' | 'github';

/**
 * Discovered skill info (from any source)
 */
export interface DiscoveredSkill {
  /** Skill name */
  name: string;
  /** Description */
  description: string;
  /** Installable source URL (e.g., "github:user/repo#path") */
  source: string;
  /** Which provider found this skill */
  provider: DiscoverySource;
  /** GitHub stars (if available) */
  stars?: number;
  /** Author name */
  author?: string;
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Keywords/tags */
  keywords?: string[];
  /** Which repos/registries contain this skill (for deduplication tracking) */
  foundIn?: string[];
}

/**
 * Search options for discovery
 */
export interface DiscoverySearchOptions {
  /** Search query */
  query: string;
  /** Max results (after deduplication) */
  limit?: number;
  /** Sources to search (auto-detected if not specified) */
  sources?: DiscoverySource[];
}

/**
 * Search result from discovery
 */
export interface DiscoveryResult {
  /** Found skills (deduplicated) */
  skills: DiscoveredSkill[];
  /** Which sources were queried */
  sourcesQueried: DiscoverySource[];
  /** Number of duplicates removed */
  duplicatesRemoved: number;
  /** Errors by source (if any) */
  errors?: Record<string, string>;
}

/**
 * Provider interface for discovery sources
 */
export interface DiscoveryProvider {
  /** Provider ID */
  readonly id: DiscoverySource;

  /** Check if provider is configured/available */
  isConfigured(): boolean;

  /** Search for skills */
  search(options: DiscoverySearchOptions): Promise<DiscoveredSkill[]>;
}

/**
 * Fetch options for getting skill content
 */
export interface FetchSkillOptions {
  /** Skill source (e.g., "github:user/repo#path" or "local:skill-name") */
  source: string;
}

/**
 * Result from fetching skill content
 */
export interface FetchSkillResult {
  /** Success flag */
  success: boolean;
  /** Raw SKILL.md content */
  content?: string;
  /** Parsed metadata */
  metadata?: {
    name: string;
    description: string;
    allowedTools?: string[];
    model?: string;
    version?: string;
    author?: string;
  };
  /** Error message if failed */
  error?: string;
  /** Resolved source URL */
  sourceUrl?: string;
}

/**
 * Discovery manager options
 */
export interface DiscoveryManagerOptions {
  /** Skillsmp API key (for skillsmp provider) */
  skillsmpApiKey?: string;
  /** GitHub token (for API rate limits) */
  githubToken?: string;
  /** Store manager for local provider */
  storeManager?: unknown;
  /** Priority repos to search first (default: miles990/claude-software-skills, claude-domain-skills) */
  priorityRepos?: string[];
}
