/**
 * Adapter types and interfaces
 */
import type { Skill } from '../types.js';

/**
 * Platform adapter interface
 */
export interface PlatformAdapter {
  /** Platform identifier (e.g., 'claude-code', 'codex') */
  name: string;

  /** Human-readable name (e.g., 'Claude Code') */
  displayName: string;

  /**
   * Detect if this platform is present in the project
   */
  detect(projectPath: string): Promise<boolean>;

  /**
   * Sync a skill to this platform
   */
  sync(skill: Skill, projectPath: string): Promise<void>;

  /**
   * Remove a skill from this platform
   */
  remove(skillName: string, projectPath: string): Promise<void>;

  /**
   * Get the output path for a skill
   */
  getOutputPath(skillName: string, projectPath: string): string;

  /**
   * Check if a path can be imported from this platform
   */
  canImport(path: string): Promise<boolean>;

  /**
   * Import a skill from this platform format
   */
  import(path: string): Promise<Skill>;
}

/**
 * Detected platform info
 */
export interface DetectedPlatform {
  name: string;
  displayName: string;
  detected: boolean;
  path: string;
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Project path (default: cwd) */
  projectPath?: string;

  /** Only sync to specific platforms */
  platforms?: string[];

  /** Dry run mode (preview only) */
  dryRun?: boolean;

  /** Backup existing files */
  backup?: boolean;
}

/**
 * Synced item info
 */
export interface SyncedItem {
  skill: string;
  platform: string;
  path: string;
}

/**
 * Skipped item info
 */
export interface SkippedItem {
  skill: string;
  platform: string;
  reason: string;
}

/**
 * Sync error info
 */
export interface SyncError {
  skill: string;
  platform: string;
  error: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  synced: SyncedItem[];
  skipped: SkippedItem[];
  errors: SyncError[];
}
