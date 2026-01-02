/**
 * Registry manifest management (registry.json)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { Registry, SkillEntry } from '../types.js';
import { getRegistryPath } from './paths.js';

/**
 * Default empty registry
 */
export function createEmptyRegistry(): Registry {
  return {
    version: '1.0',
    skills: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Load registry from disk
 */
export async function loadRegistry(storeDir: string): Promise<Registry> {
  const registryPath = getRegistryPath(storeDir);

  if (!existsSync(registryPath)) {
    return createEmptyRegistry();
  }

  try {
    const content = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(content) as Registry;

    // Validate basic structure
    if (!registry.version || !registry.skills) {
      return createEmptyRegistry();
    }

    return registry;
  } catch {
    // If file is corrupted, return empty registry
    return createEmptyRegistry();
  }
}

/**
 * Save registry to disk (atomic write)
 */
export async function saveRegistry(storeDir: string, registry: Registry): Promise<void> {
  const registryPath = getRegistryPath(storeDir);

  // Ensure directory exists
  await mkdir(dirname(registryPath), { recursive: true });

  // Update timestamp
  registry.lastUpdated = new Date().toISOString();

  // Write atomically by writing to temp file first
  const tempPath = `${registryPath}.tmp`;
  const content = JSON.stringify(registry, null, 2);

  await writeFile(tempPath, content, 'utf-8');

  // Rename temp to actual (atomic on most filesystems)
  const { rename } = await import('fs/promises');
  await rename(tempPath, registryPath);
}

/**
 * Add or update a skill entry in the registry
 */
export async function addSkillToRegistry(
  storeDir: string,
  skillName: string,
  entry: Omit<SkillEntry, 'name'>
): Promise<void> {
  const registry = await loadRegistry(storeDir);

  registry.skills[skillName] = {
    name: skillName,
    ...entry,
  };

  await saveRegistry(storeDir, registry);
}

/**
 * Remove a skill from the registry
 */
export async function removeSkillFromRegistry(storeDir: string, skillName: string): Promise<boolean> {
  const registry = await loadRegistry(storeDir);

  if (!registry.skills[skillName]) {
    return false;
  }

  delete registry.skills[skillName];
  await saveRegistry(storeDir, registry);

  return true;
}

/**
 * Get a skill entry from the registry
 */
export async function getSkillFromRegistry(
  storeDir: string,
  skillName: string
): Promise<SkillEntry | null> {
  const registry = await loadRegistry(storeDir);
  return registry.skills[skillName] || null;
}

/**
 * List all skills in the registry
 */
export async function listSkillsInRegistry(storeDir: string): Promise<SkillEntry[]> {
  const registry = await loadRegistry(storeDir);
  return Object.values(registry.skills);
}

/**
 * Update synced platforms for a skill
 */
export async function updateSyncedPlatforms(
  storeDir: string,
  skillName: string,
  platforms: string[]
): Promise<void> {
  const registry = await loadRegistry(storeDir);

  if (registry.skills[skillName]) {
    registry.skills[skillName].syncedPlatforms = platforms;
    registry.skills[skillName].lastSynced = new Date().toISOString();
    await saveRegistry(storeDir, registry);
  }
}
