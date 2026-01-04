/**
 * Installer types - Dependency-aware skill installation
 */
import type { Skill, BaseResult } from '../types.js';
import type { SkillFile } from '../fetcher/types.js';

/**
 * Installation source types
 */
export type InstallSource =
  | { type: 'github'; repo: string; ref?: string }
  | { type: 'url'; url: string }
  | { type: 'local'; path: string }
  | { type: 'registry'; name: string; version?: string };

/**
 * Install options
 */
export interface InstallOptions {
  /** Force reinstall even if already installed */
  force?: boolean;
  /** Skip dependency resolution */
  skipDependencies?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Single skill install result
 */
export interface SkillInstallResult {
  /** Skill name */
  name: string;
  /** Skill version */
  version: string;
  /** Whether installation succeeded */
  success: boolean;
  /** Action taken */
  action: 'installed' | 'updated' | 'skipped' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Whether this was a transitive dependency */
  transitive: boolean;
  /** Skill that required this dependency */
  requiredBy?: string;
}

/**
 * Overall install result
 */
export interface InstallResult extends BaseResult {
  /** Individual skill results */
  skills: SkillInstallResult[];
  /** MCP servers that need manual installation */
  mcpRequired: string[];
  /** Summary stats */
  stats: {
    installed: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

/**
 * Uninstall options
 */
export interface UninstallOptions {
  /** Force uninstall even if other skills depend on it */
  force?: boolean;
  /** Remove orphan dependencies too */
  removeOrphans?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
}

/**
 * Installer uninstall check result
 * Note: Named differently from state.UninstallCheck to avoid conflicts
 */
export interface InstallerUninstallCheck {
  /** Whether can safely uninstall */
  canUninstall: boolean;
  /** Skills that depend on this skill */
  dependents: string[];
}

/**
 * Uninstall result
 */
export interface UninstallResult extends BaseResult {
  /** Skills that were removed */
  removed: string[];
  /** Orphan dependencies that were cleaned */
  orphansRemoved: string[];
}

/**
 * Skill fetch result with optional files
 */
export interface SkillFetchResult {
  skill: Skill;
  files?: SkillFile[];
}

/**
 * Skill fetcher interface for dependency resolution
 */
export interface SkillFetcherAdapter {
  /** Fetch skill metadata from source */
  fetchMetadata(source: string): Promise<{
    name: string;
    version: string;
    dependencies?: {
      skills?: string[];
      mcp?: string[];
    };
  } | null>;

  /** Fetch full skill from source (with optional files) */
  fetchSkill(source: string): Promise<SkillFetchResult | null>;
}

/**
 * Install from config result
 */
export interface InstallFromConfigResult {
  /** Overall success */
  success: boolean;
  /** Skills that were processed */
  skills: SkillInstallResult[];
  /** MCP servers that need attention */
  mcpRequired: string[];
  /** Errors */
  errors: string[];
}
