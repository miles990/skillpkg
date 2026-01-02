/**
 * State types (state.json)
 *
 * Tracks installation state, dependencies, and sync history
 */

import type { SyncTarget } from '../config/types.js';

/**
 * Schema version for state.json
 */
export const STATE_SCHEMA_VERSION = 'skillpkg-state-v1';

/**
 * Who installed a skill
 */
export type InstalledBy = 'user' | string;

/**
 * Skill installation state
 */
export interface SkillState {
  /** Installed version */
  version: string;
  /** Source (github:user/repo, URL, or local path) */
  source: string;
  /** Who installed this skill ('user' or skill name that depends on it) */
  installed_by: InstalledBy;
  /** Installation timestamp (ISO 8601) */
  installed_at: string;
  /** Skills that depend on this skill */
  depended_by: string[];
}

/**
 * MCP installation state
 */
export interface McpState {
  /** npm package name */
  package: string;
  /** Skill that required this MCP (null if manually installed) */
  installed_by_skill: string | null;
  /** Installation timestamp (ISO 8601) */
  installed_at: string;
}

/**
 * Sync history for each target
 */
export type SyncHistory = Partial<Record<SyncTarget, string>>;

/**
 * Complete state (state.json)
 */
export interface State {
  /** Schema version */
  $schema: string;
  /** Installed skills */
  skills: Record<string, SkillState>;
  /** Installed MCP servers */
  mcp: Record<string, McpState>;
  /** Last sync timestamp for each target */
  sync_history: SyncHistory;
}

/**
 * Skill install info (for recording)
 */
export interface SkillInstallInfo {
  version: string;
  source: string;
  installed_by: InstalledBy;
}

/**
 * MCP install info (for recording)
 */
export interface McpInstallInfo {
  package: string;
  installed_by_skill: string | null;
}

/**
 * Uninstall check result
 */
export interface UninstallCheck {
  /** Can the skill be safely uninstalled */
  canUninstall: boolean;
  /** Skills that depend on this skill */
  dependents: string[];
}

/**
 * Create an empty state
 */
export function createEmptyState(): State {
  return {
    $schema: STATE_SCHEMA_VERSION,
    skills: {},
    mcp: {},
    sync_history: {},
  };
}
