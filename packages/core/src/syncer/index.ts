/**
 * Syncer module - Sync skills to AI tool directories
 *
 * @example
 * ```typescript
 * import { createSyncer, loadSkillsFromDirectory } from '@skillpkg/core';
 *
 * // Load skills
 * const skills = await loadSkillsFromDirectory('.skillpkg/skills');
 *
 * // Create syncer
 * const syncer = createSyncer();
 *
 * // Sync to all enabled targets
 * const result = await syncer.syncAll(projectPath, skills, config);
 *
 * // Or sync to a specific target
 * const targetResult = await syncer.syncToTarget(
 *   projectPath,
 *   skills,
 *   getTargetConfig('claude-code')
 * );
 * ```
 */

// Types
export type {
  SyncFormat,
  FrontmatterHandling,
  TargetConfig,
  SkillContent,
  SyncerOptions,
  FileSyncResult,
  TargetSyncResult,
  SyncerResult,
  McpJsonConfig,
} from './types.js';

export {
  TARGET_CONFIGS,
  getTargetConfig,
  getImplementedTargets,
  getAllTargets,
} from './types.js';

// Syncer
export {
  Syncer,
  createSyncer,
  loadSkillContent,
  loadSkillsFromDirectory,
} from './syncer.js';
