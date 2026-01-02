/**
 * Installer module - Dependency-aware skill installation
 *
 * @example
 * ```typescript
 * import { createInstaller, createStateManager, createConfigManager } from '@skillpkg/core';
 * import { StoreManager } from '@skillpkg/core';
 *
 * // Create dependencies
 * const stateManager = createStateManager();
 * const configManager = createConfigManager();
 * const storeManager = new StoreManager();
 * const fetcher = {
 *   async fetchMetadata(source) { ... },
 *   async fetchSkill(source) { ... },
 * };
 *
 * // Create installer
 * const installer = createInstaller(stateManager, configManager, storeManager, fetcher);
 *
 * // Install with dependencies
 * const result = await installer.install(projectPath, 'github:user/my-skill');
 *
 * // Uninstall with dependency check
 * const uninstallResult = await installer.uninstall(projectPath, 'my-skill');
 *
 * // Install all from config
 * const configResult = await installer.installFromConfig(projectPath);
 * ```
 */

// Types
export type {
  InstallSource,
  InstallOptions,
  InstallResult,
  SkillInstallResult,
  UninstallOptions,
  InstallerUninstallCheck,
  UninstallResult,
  SkillFetcherAdapter,
  InstallFromConfigResult,
} from './types.js';

// Installer
export { Installer, createInstaller } from './installer.js';
