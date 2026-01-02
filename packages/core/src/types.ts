/**
 * Core types for skillpkg
 */

/**
 * Skill schema version
 */
export const SCHEMA_VERSION = '1.0';

/**
 * Skill author information
 */
export interface Author {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Capability types that a skill can require
 */
export type Capability =
  | 'file:read'
  | 'file:write'
  | 'shell:execute'
  | 'web:search'
  | 'web:fetch'
  | 'mcp:*';

/**
 * Claude Code specific configuration
 */
export interface ClaudeCodeConfig {
  'allowed-tools'?: string[];
}

/**
 * Codex (OpenAI) specific configuration
 */
export interface CodexConfig {
  sandbox?: boolean;
}

/**
 * GitHub Copilot specific configuration
 */
export interface CopilotConfig {
  mode?: 'edit' | 'chat';
}

/**
 * Cline specific configuration
 */
export interface ClineConfig {
  /** Custom rules file path */
  customRules?: string;
}

/**
 * Platform-specific configurations
 */
export interface PlatformConfig {
  'claude-code'?: ClaudeCodeConfig;
  codex?: CodexConfig;
  copilot?: CopilotConfig;
  cline?: ClineConfig;
}

/**
 * Main Skill interface - represents a skill.yaml
 */
export interface Skill {
  /** Schema version (e.g., "1.0") */
  schema: string;

  /** Unique skill identifier in kebab-case */
  name: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Short description of the skill */
  description: string;

  /** Markdown instructions for the AI agent */
  instructions: string;

  /** Author information */
  author?: string | Author;

  /** License (e.g., "MIT") */
  license?: string;

  /** Repository URL */
  repository?: string;

  /** Keywords for search */
  keywords?: string[];

  /** Trigger words to activate the skill */
  triggers?: string[];

  /** Required capabilities */
  capabilities?: Capability[];

  /** Platform-specific configurations */
  platforms?: PlatformConfig;

  /** Skill dependencies */
  dependencies?: Record<string, string>;
}

/**
 * Skill entry in local registry
 */
export interface SkillEntry {
  name: string;
  version: string;
  installedAt: string;
  source: 'registry' | 'local' | 'import';
  sourceUrl?: string;
  syncedPlatforms: string[];
  lastSynced?: string;
}

/**
 * Local registry manifest
 */
export interface Registry {
  version: string;
  skills: Record<string, SkillEntry>;
  lastUpdated: string;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  url: string;
  token?: string;
  scope?: string;
}

/**
 * Global configuration
 */
export interface Config {
  registry: string;
  registries: Record<string, RegistryConfig>;
  defaultPlatforms: string[];
  autoSync: boolean;
  ui: {
    port: number;
    openBrowser: boolean;
  };
  mcp: {
    enabled: boolean;
    port: number;
  };
}
