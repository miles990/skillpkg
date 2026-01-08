/**
 * Discovery module - Multi-source skill discovery
 *
 * Provides unified interface for searching skills across multiple sources:
 * - priority: Priority repos (miles990/claude-software-skills, claude-domain-skills) - SEARCHED FIRST
 * - local: Installed skills (via StoreManager)
 * - skillsmp: Primary registry (40K+ skills, requires API key)
 * - awesome: Fallback curated repos (no key required)
 * - github: Supplementary search (topic-based with SKILL.md detection)
 *
 * Features:
 * - Auto source selection based on API key availability
 * - Priority repos searched first by default
 * - Deduplication with foundIn tracking
 * - Caching per provider (skillsmp/github: 5min, priority/awesome: 30min)
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
  PriorityProvider,
  createPriorityProvider,
  SKILLSMP_CONFIG,
  AWESOME_REPOS,
  DEFAULT_PRIORITY_REPOS,
} from './providers/index.js';
