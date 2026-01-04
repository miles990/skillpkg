/**
 * Discovery module - Multi-source skill discovery
 *
 * Provides unified interface for searching skills across multiple sources:
 * - local: Installed skills (via StoreManager)
 * - skillsmp: Primary registry (40K+ skills, requires API key)
 * - awesome: Fallback curated repos (no key required)
 * - github: Supplementary search (topic-based with SKILL.md detection)
 *
 * Features:
 * - Auto source selection based on API key availability
 * - Deduplication with foundIn tracking
 * - Caching per provider (skillsmp/github: 5min, awesome: 30min)
 */

// Types
export type {
  DiscoverySource,
  DiscoveredSkill,
  DiscoverySearchOptions,
  DiscoveryResult,
  DiscoveryProvider,
  FetchSkillOptions,
  FetchSkillResult,
  DiscoveryManagerOptions,
} from './types.js';

// Manager
export { DiscoveryManager, createDiscoveryManager } from './discovery-manager.js';

// Providers
export {
  LocalProvider,
  createLocalProvider,
  SkillsmpProvider,
  createSkillsmpProvider,
  AwesomeProvider,
  createAwesomeProvider,
  GitHubProvider,
  createGitHubProvider,
  SKILLSMP_CONFIG,
  AWESOME_REPOS,
} from './providers/index.js';
