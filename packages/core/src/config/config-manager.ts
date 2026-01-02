/**
 * ConfigManager - Project configuration management (skillpkg.json)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { SkillpkgConfig, McpConfig, SyncTargets } from './types.js';
import { createDefaultConfig } from './types.js';
import skillpkgSchema from './schemas/skillpkg.schema.json' with { type: 'json' };

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = 'skillpkg.json';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * ConfigManager class - manages skillpkg.json
 */
export class ConfigManager {
  private ajv: Ajv;
  private validate: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.validate = this.ajv.compile(skillpkgSchema);
  }

  /**
   * Get the config file path for a project
   */
  getConfigPath(projectPath: string): string {
    return join(projectPath, CONFIG_FILE_NAME);
  }

  /**
   * Check if a project has skillpkg.json
   */
  hasConfig(projectPath: string): boolean {
    return existsSync(this.getConfigPath(projectPath));
  }

  /**
   * Load project configuration
   */
  async loadProjectConfig(projectPath: string): Promise<SkillpkgConfig | null> {
    const configPath = this.getConfigPath(projectPath);

    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as SkillpkgConfig;

      // Validate
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid skillpkg.json: ${validation.errors?.join(', ')}`);
      }

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in skillpkg.json: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save project configuration
   */
  async saveProjectConfig(projectPath: string, config: SkillpkgConfig): Promise<void> {
    const configPath = this.getConfigPath(projectPath);

    // Validate before saving
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
    }

    // Ensure directory exists
    await mkdir(dirname(configPath), { recursive: true });

    // Write with pretty formatting
    const content = JSON.stringify(config, null, 2);
    await writeFile(configPath, content, 'utf-8');
  }

  /**
   * Initialize a new project with skillpkg.json
   */
  async initProject(
    projectPath: string,
    name: string,
    options: { force?: boolean } = {}
  ): Promise<SkillpkgConfig> {
    const configPath = this.getConfigPath(projectPath);

    if (existsSync(configPath) && !options.force) {
      throw new Error(`skillpkg.json already exists at ${projectPath}`);
    }

    const config = createDefaultConfig(name);
    await this.saveProjectConfig(projectPath, config);

    return config;
  }

  /**
   * Add a skill to the project configuration
   */
  async addSkill(projectPath: string, name: string, source: string): Promise<void> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found. Run "skillpkg init" first.');
    }

    if (!config.skills) {
      config.skills = {};
    }

    config.skills[name] = source;
    await this.saveProjectConfig(projectPath, config);
  }

  /**
   * Remove a skill from the project configuration
   */
  async removeSkill(projectPath: string, name: string): Promise<boolean> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found.');
    }

    if (!config.skills || !config.skills[name]) {
      return false;
    }

    delete config.skills[name];
    await this.saveProjectConfig(projectPath, config);
    return true;
  }

  /**
   * Add or update an MCP configuration
   */
  async setMcp(projectPath: string, name: string, mcpConfig: McpConfig): Promise<void> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found. Run "skillpkg init" first.');
    }

    if (!config.mcp) {
      config.mcp = {};
    }

    config.mcp[name] = mcpConfig;
    await this.saveProjectConfig(projectPath, config);
  }

  /**
   * Remove an MCP configuration
   */
  async removeMcp(projectPath: string, name: string): Promise<boolean> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found.');
    }

    if (!config.mcp || !config.mcp[name]) {
      return false;
    }

    delete config.mcp[name];
    await this.saveProjectConfig(projectPath, config);
    return true;
  }

  /**
   * Update sync targets
   */
  async setSyncTargets(projectPath: string, targets: SyncTargets): Promise<void> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found.');
    }

    config.sync_targets = { ...config.sync_targets, ...targets };
    await this.saveProjectConfig(projectPath, config);
  }

  /**
   * Add a reminder
   */
  async addReminder(projectPath: string, reminder: string): Promise<void> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config) {
      throw new Error('No skillpkg.json found.');
    }

    if (!config.reminders) {
      config.reminders = [];
    }

    if (!config.reminders.includes(reminder)) {
      config.reminders.push(reminder);
      await this.saveProjectConfig(projectPath, config);
    }
  }

  /**
   * Remove a reminder by index
   */
  async removeReminder(projectPath: string, index: number): Promise<boolean> {
    const config = await this.loadProjectConfig(projectPath);
    if (!config || !config.reminders || index < 0 || index >= config.reminders.length) {
      return false;
    }

    config.reminders.splice(index, 1);
    await this.saveProjectConfig(projectPath, config);
    return true;
  }

  /**
   * Validate a configuration object
   */
  validateConfig(config: unknown): ValidationResult {
    const valid = this.validate(config);

    if (valid) {
      return { valid: true };
    }

    const errors = this.validate.errors?.map((err) => {
      const path = err.instancePath || 'root';
      return `${path}: ${err.message}`;
    });

    return { valid: false, errors };
  }

  /**
   * Get enabled sync targets
   */
  getEnabledSyncTargets(config: SkillpkgConfig): string[] {
    if (!config.sync_targets) {
      return ['claude-code']; // Default
    }

    return Object.entries(config.sync_targets)
      .filter(([, enabled]) => enabled)
      .map(([target]) => target);
  }
}

/**
 * Create a ConfigManager instance
 */
export function createConfigManager(): ConfigManager {
  return new ConfigManager();
}
