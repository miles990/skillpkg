/**
 * Importer types
 */
import type { Skill } from '../types.js';

/**
 * Import result for a single file
 */
export interface ImportResult {
  path: string;
  success: boolean;
  skill?: Skill;
  platform?: string;
  error?: string;
}

/**
 * Batch import result
 */
export interface BatchImportResult {
  imported: ImportResult[];
  failed: ImportResult[];
  skipped: ImportResult[];
  total: number;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Dry run - don't actually save */
  dryRun?: boolean;
  /** Target platform to import from (auto-detect if not specified) */
  platform?: string;
  /** Whether to overwrite existing skills */
  overwrite?: boolean;
}

/**
 * Detected file info
 */
export interface DetectedFile {
  path: string;
  platform: string;
  displayName: string;
}
