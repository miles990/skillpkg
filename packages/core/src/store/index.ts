/**
 * Store module - public API
 *
 * Provides local skill storage management.
 *
 * @example
 * ```typescript
 * import { StoreManager, createGlobalStore } from '@skillpkg/core/store';
 *
 * const store = createGlobalStore();
 * await store.init();
 *
 * const skills = await store.listSkills();
 * ```
 */

// Main exports
export { StoreManager, createGlobalStore, createLocalStore } from './store-manager.js';
export type { StoreOptions, SkillMeta } from './store-manager.js';

// Path utilities
export {
  getGlobalDir,
  getLocalDir,
  getSkillsDir,
  getSkillDir,
  getSkillMdPath,
  getSkillYamlPath,
  getRegistryPath,
  getConfigPath,
  getCredentialsPath,
  getCacheDir,
} from './paths.js';

// Registry operations
export {
  loadRegistry,
  saveRegistry,
  addSkillToRegistry,
  removeSkillFromRegistry,
  getSkillFromRegistry,
  listSkillsInRegistry,
  createEmptyRegistry,
} from './registry.js';

// Config operations
export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  updateConfig,
  resetConfig,
  getDefaultConfig,
} from './config.js';
