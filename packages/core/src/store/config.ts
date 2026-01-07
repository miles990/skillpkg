/**
 * Configuration management (config.json)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { Config } from '../types.js';
import { getConfigPath } from './paths.js';

/**
 * Default configuration
 */
export function getDefaultConfig(): Config {
  return {
    registry: 'https://registry.skillpkg.dev',
    registries: {},
    defaultPlatforms: ['claude-code', 'codex', 'copilot', 'cline'],
    autoSync: true,
    autoSyncTargets: {
      'claude-code': true,
    },
    ui: {
      port: 3737,
      openBrowser: true,
    },
    mcp: {
      enabled: true,
      port: 3838,
    },
  };
}

/**
 * Deep merge two Config objects
 */
function deepMergeConfig(target: Config, source: Partial<Config>): Config {
  const result = { ...target };

  // Merge top-level simple properties
  if (source.registry !== undefined) result.registry = source.registry;
  if (source.autoSync !== undefined) result.autoSync = source.autoSync;
  if (source.defaultPlatforms !== undefined) result.defaultPlatforms = source.defaultPlatforms;

  // Merge registries object
  if (source.registries !== undefined) {
    result.registries = { ...target.registries, ...source.registries };
  }

  // Merge autoSyncTargets object
  if (source.autoSyncTargets !== undefined) {
    result.autoSyncTargets = { ...target.autoSyncTargets, ...source.autoSyncTargets };
  }

  // Merge nested ui object
  if (source.ui !== undefined) {
    result.ui = { ...target.ui, ...source.ui };
  }

  // Merge nested mcp object
  if (source.mcp !== undefined) {
    result.mcp = { ...target.mcp, ...source.mcp };
  }

  return result;
}

/**
 * Load configuration from disk
 */
export async function loadConfig(storeDir: string): Promise<Config> {
  const configPath = getConfigPath(storeDir);
  const defaultConfig = getDefaultConfig();

  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<Config>;

    // Merge with defaults
    return deepMergeConfig(defaultConfig, userConfig);
  } catch {
    // If file is corrupted, return defaults
    return defaultConfig;
  }
}

/**
 * Save configuration to disk
 */
export async function saveConfig(storeDir: string, config: Config): Promise<void> {
  const configPath = getConfigPath(storeDir);

  // Ensure directory exists
  await mkdir(dirname(configPath), { recursive: true });

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, 'utf-8');
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof Config>(
  storeDir: string,
  key: K
): Promise<Config[K]> {
  const config = await loadConfig(storeDir);
  return config[key];
}

/**
 * Set a specific config value
 */
export async function setConfigValue<K extends keyof Config>(
  storeDir: string,
  key: K,
  value: Config[K]
): Promise<void> {
  const config = await loadConfig(storeDir);
  config[key] = value;
  await saveConfig(storeDir, config);
}

/**
 * Update configuration with partial values
 */
export async function updateConfig(storeDir: string, updates: Partial<Config>): Promise<void> {
  const config = await loadConfig(storeDir);
  const updatedConfig = deepMergeConfig(config, updates);
  await saveConfig(storeDir, updatedConfig);
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(storeDir: string): Promise<void> {
  await saveConfig(storeDir, getDefaultConfig());
}
