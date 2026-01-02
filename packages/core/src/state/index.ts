/**
 * State module - Installation state tracking (.skillpkg/state.json)
 *
 * @example
 * ```typescript
 * import { StateManager, createStateManager } from '@skillpkg/core';
 *
 * const manager = createStateManager();
 *
 * // Load state
 * const state = await manager.loadState('/path/to/project');
 *
 * // Record skill installation
 * await manager.recordSkillInstall('/path/to/project', 'my-skill', {
 *   version: '1.0.0',
 *   source: 'github:user/repo',
 *   installed_by: 'user',
 * });
 *
 * // Check if can uninstall
 * const check = manager.canUninstall(state, 'my-skill');
 * if (!check.canUninstall) {
 *   console.log('Cannot uninstall, depended by:', check.dependents);
 * }
 * ```
 */

// Types
export type {
  State,
  SkillState,
  McpState,
  SkillInstallInfo,
  McpInstallInfo,
  UninstallCheck,
  SyncHistory,
  InstalledBy,
} from './types.js';

export { STATE_SCHEMA_VERSION, createEmptyState } from './types.js';

// StateManager
export {
  StateManager,
  createStateManager,
  STATE_DIR,
  STATE_FILE_NAME,
} from './state-manager.js';
