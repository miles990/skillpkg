/**
 * Config module - Project configuration management (skillpkg.json)
 *
 * @example
 * ```typescript
 * import { ConfigManager, createConfigManager } from '@skillpkg/core';
 *
 * const manager = createConfigManager();
 *
 * // Initialize a new project
 * await manager.initProject('/path/to/project', 'my-project');
 *
 * // Load configuration
 * const config = await manager.loadProjectConfig('/path/to/project');
 *
 * // Add a skill
 * await manager.addSkill('/path/to/project', 'my-skill', 'github:user/repo');
 * ```
 */

// Types
export type {
  SkillpkgConfig,
  McpConfig,
  SyncTarget,
  SyncTargets,
  Hooks,
} from './types.js';

export { DEFAULT_SYNC_TARGETS, createDefaultConfig } from './types.js';

// ConfigManager
export {
  ConfigManager,
  createConfigManager,
  CONFIG_FILE_NAME,
  type ValidationResult as ConfigValidationResult,
} from './config-manager.js';
