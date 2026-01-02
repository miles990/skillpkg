/**
 * Path utilities for skillpkg store
 */
import { homedir } from 'os';
import { join } from 'path';

/**
 * Get the global skillpkg directory (~/.skillpkg)
 */
export function getGlobalDir(): string {
  return join(homedir(), '.skillpkg');
}

/**
 * Get the local skillpkg directory (./.skillpkg)
 */
export function getLocalDir(projectPath: string = process.cwd()): string {
  return join(projectPath, '.skillpkg');
}

/**
 * Get the skills directory within a store
 */
export function getSkillsDir(storeDir: string): string {
  return join(storeDir, 'skills');
}

/**
 * Get the path to a specific skill directory
 */
export function getSkillDir(storeDir: string, skillName: string): string {
  return join(getSkillsDir(storeDir), skillName);
}

/**
 * Get the path to a skill.yaml file
 */
export function getSkillYamlPath(storeDir: string, skillName: string): string {
  return join(getSkillDir(storeDir, skillName), 'skill.yaml');
}

/**
 * Get the registry.json path
 */
export function getRegistryPath(storeDir: string): string {
  return join(storeDir, 'registry.json');
}

/**
 * Get the config.json path
 */
export function getConfigPath(storeDir: string): string {
  return join(storeDir, 'config.json');
}

/**
 * Get the credentials file path
 */
export function getCredentialsPath(storeDir: string): string {
  return join(storeDir, 'credentials.json');
}

/**
 * Get the cache directory path
 */
export function getCacheDir(storeDir: string): string {
  return join(storeDir, 'cache');
}
