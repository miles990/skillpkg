/**
 * skillpkg.json types
 *
 * Project-level configuration for skillpkg v2.0
 */

/**
 * MCP server configuration
 */
export interface McpConfig {
  /** npm package name */
  package: string;
  /** Executable command name */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Whether this MCP is required for the project */
  required?: boolean;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Supported sync targets
 * Note: v2.0 only implements claude-code, others are reserved for future
 */
export type SyncTarget = 'claude-code' | 'cursor' | 'codex' | 'copilot' | 'windsurf';

/**
 * Sync targets configuration
 */
export type SyncTargets = Partial<Record<SyncTarget, boolean>>;

/**
 * Lifecycle hooks
 */
export interface Hooks {
  'pre-install'?: string;
  'post-install'?: string;
  'pre-sync'?: string;
  'post-sync'?: string;
  [key: string]: string | undefined;
}

/**
 * Project configuration (skillpkg.json)
 */
export interface SkillpkgConfig {
  /** JSON Schema reference */
  $schema?: string;
  /** Project name */
  name: string;
  /** Project version (semver) */
  version?: string;
  /** Skills to install (name -> source) */
  skills?: Record<string, string>;
  /** MCP server configurations */
  mcp?: Record<string, McpConfig>;
  /** Project-level reminders for AI agents */
  reminders?: string[];
  /** Lifecycle hooks */
  hooks?: Hooks;
  /** Sync targets (target -> enabled) */
  sync_targets?: SyncTargets;
}

/**
 * Default sync targets (only claude-code enabled by default)
 */
export const DEFAULT_SYNC_TARGETS: SyncTargets = {
  'claude-code': true,
  cursor: false,
  codex: false,
  copilot: false,
  windsurf: false,
};

/**
 * Create a default project configuration
 */
export function createDefaultConfig(name: string): SkillpkgConfig {
  return {
    $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
    name,
    skills: {},
    mcp: {},
    reminders: [],
    sync_targets: { 'claude-code': true },
  };
}
