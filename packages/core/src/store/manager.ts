/**
 * Store Manager - manages skill storage
 */
import { mkdir, readFile, writeFile, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { Skill, Registry, Config, SkillEntry } from '../types.js';
import { parse, stringify } from '../parser/index.js';
import {
  getGlobalDir,
  getLocalDir,
  getSkillsDir,
  getSkillDir,
  getSkillYamlPath,
} from './paths.js';
import {
  loadRegistry,
  saveRegistry,
  addSkillToRegistry,
  removeSkillFromRegistry,
  getSkillFromRegistry,
  listSkillsInRegistry,
  updateSyncedPlatforms,
} from './registry.js';
import { loadConfig, saveConfig } from './config.js';

/**
 * Store options
 */
export interface StoreOptions {
  /** Use global store (~/.skillpkg) instead of local */
  global?: boolean;
  /** Custom store path (overrides global option) */
  storePath?: string;
}

/**
 * Skill metadata (without instructions)
 */
export interface SkillMeta {
  name: string;
  version: string;
  description: string;
  author?: string;
  installedAt: string;
  source: 'registry' | 'local' | 'import';
  syncedPlatforms: string[];
}

/**
 * Store Manager class
 */
export class StoreManager {
  private storeDir: string;

  constructor(options: StoreOptions = {}) {
    if (options.storePath) {
      this.storeDir = options.storePath;
    } else if (options.global) {
      this.storeDir = getGlobalDir();
    } else {
      this.storeDir = getLocalDir();
    }
  }

  /**
   * Get the store directory path
   */
  getStoreDir(): string {
    return this.storeDir;
  }

  /**
   * Initialize the store directory structure
   */
  async init(): Promise<void> {
    const skillsDir = getSkillsDir(this.storeDir);

    // Create directories
    await mkdir(skillsDir, { recursive: true });

    // Initialize config if not exists
    const config = await loadConfig(this.storeDir);
    await saveConfig(this.storeDir, config);

    // Initialize registry if not exists
    const registry = await loadRegistry(this.storeDir);
    await saveRegistry(this.storeDir, registry);
  }

  /**
   * Check if the store is initialized
   */
  async isInitialized(): Promise<boolean> {
    return existsSync(this.storeDir) && existsSync(getSkillsDir(this.storeDir));
  }

  // ==================== Skill Operations ====================

  /**
   * Get a skill by name
   */
  async getSkill(name: string): Promise<Skill | null> {
    const skillPath = getSkillYamlPath(this.storeDir, name);

    if (!existsSync(skillPath)) {
      return null;
    }

    try {
      const content = await readFile(skillPath, 'utf-8');
      const result = parse(content);

      if (!result.success || !result.data) {
        return null;
      }

      return result.data;
    } catch {
      return null;
    }
  }

  /**
   * List all installed skills (metadata only)
   */
  async listSkills(): Promise<SkillMeta[]> {
    const entries = await listSkillsInRegistry(this.storeDir);
    const skills: SkillMeta[] = [];

    for (const entry of entries) {
      const skill = await this.getSkill(entry.name);
      if (skill) {
        skills.push({
          name: skill.name,
          version: skill.version,
          description: skill.description,
          author: typeof skill.author === 'string' ? skill.author : skill.author?.name,
          installedAt: entry.installedAt,
          source: entry.source,
          syncedPlatforms: entry.syncedPlatforms,
        });
      }
    }

    return skills;
  }

  /**
   * Add a skill to the store
   */
  async addSkill(
    skill: Skill,
    options: { source?: 'registry' | 'local' | 'import'; sourceUrl?: string } = {}
  ): Promise<void> {
    const { source = 'local', sourceUrl } = options;

    // Create skill directory
    const skillDir = getSkillDir(this.storeDir, skill.name);
    await mkdir(skillDir, { recursive: true });

    // Write skill.yaml
    const skillPath = getSkillYamlPath(this.storeDir, skill.name);
    const content = stringify(skill);
    await writeFile(skillPath, content, 'utf-8');

    // Update registry
    await addSkillToRegistry(this.storeDir, skill.name, {
      version: skill.version,
      installedAt: new Date().toISOString(),
      source,
      sourceUrl,
      syncedPlatforms: [],
    });
  }

  /**
   * Update an existing skill
   */
  async updateSkill(name: string, skill: Skill): Promise<void> {
    const existing = await this.getSkill(name);
    if (!existing) {
      throw new Error(`Skill not found: ${name}`);
    }

    // Get existing registry entry
    const entry = await getSkillFromRegistry(this.storeDir, name);

    // Write updated skill.yaml
    const skillPath = getSkillYamlPath(this.storeDir, name);
    const content = stringify(skill);
    await writeFile(skillPath, content, 'utf-8');

    // Update registry with new version
    if (entry) {
      await addSkillToRegistry(this.storeDir, name, {
        ...entry,
        version: skill.version,
      });
    }
  }

  /**
   * Remove a skill from the store
   */
  async removeSkill(name: string): Promise<boolean> {
    const skillDir = getSkillDir(this.storeDir, name);

    if (!existsSync(skillDir)) {
      return false;
    }

    // Remove skill directory
    await rm(skillDir, { recursive: true });

    // Remove from registry
    await removeSkillFromRegistry(this.storeDir, name);

    return true;
  }

  /**
   * Check if a skill exists
   */
  async hasSkill(name: string): Promise<boolean> {
    const skill = await this.getSkill(name);
    return skill !== null;
  }

  /**
   * Get skill entry from registry
   */
  async getSkillEntry(name: string): Promise<SkillEntry | null> {
    return getSkillFromRegistry(this.storeDir, name);
  }

  /**
   * Update synced platforms for a skill
   */
  async updateSyncedPlatforms(name: string, platforms: string[]): Promise<void> {
    await updateSyncedPlatforms(this.storeDir, name, platforms);
  }

  // ==================== Registry Operations ====================

  /**
   * Get the full registry
   */
  async getRegistry(): Promise<Registry> {
    return loadRegistry(this.storeDir);
  }

  /**
   * Save the registry
   */
  async saveRegistry(registry: Registry): Promise<void> {
    return saveRegistry(this.storeDir, registry);
  }

  // ==================== Config Operations ====================

  /**
   * Get the configuration
   */
  async getConfig(): Promise<Config> {
    return loadConfig(this.storeDir);
  }

  /**
   * Save the configuration
   */
  async saveConfig(config: Config): Promise<void> {
    return saveConfig(this.storeDir, config);
  }

  /**
   * Set a config value
   */
  async setConfigValue<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    const config = await this.getConfig();
    config[key] = value;
    await this.saveConfig(config);
  }

  // ==================== Utility Methods ====================

  /**
   * Get all skill names from the skills directory
   */
  async getSkillNames(): Promise<string[]> {
    const skillsDir = getSkillsDir(this.storeDir);

    if (!existsSync(skillsDir)) {
      return [];
    }

    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  /**
   * Clean orphaned skills (in registry but not on disk)
   */
  async cleanOrphans(): Promise<string[]> {
    const registry = await this.getRegistry();
    const diskSkills = await this.getSkillNames();
    const orphans: string[] = [];

    for (const name of Object.keys(registry.skills)) {
      if (!diskSkills.includes(name)) {
        orphans.push(name);
        delete registry.skills[name];
      }
    }

    if (orphans.length > 0) {
      await this.saveRegistry(registry);
    }

    return orphans;
  }
}

/**
 * Create a global store manager
 */
export function createGlobalStore(): StoreManager {
  return new StoreManager({ global: true });
}

/**
 * Create a local store manager
 */
export function createLocalStore(projectPath?: string): StoreManager {
  return new StoreManager({
    storePath: projectPath ? getLocalDir(projectPath) : undefined,
  });
}
