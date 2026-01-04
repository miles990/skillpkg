/**
 * StateManager - Installation state tracking (.skillpkg/state.json)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type {
  State,
  SkillState,
  McpState,
  SkillInstallInfo,
  McpInstallInfo,
  UninstallCheck,
} from './types.js';
import { createEmptyState, STATE_SCHEMA_VERSION } from './types.js';
import type { SyncTarget } from '../config/types.js';

/**
 * State file location within project
 */
export const STATE_DIR = '.skillpkg';
export const STATE_FILE_NAME = 'state.json';

/**
 * StateManager class - manages .skillpkg/state.json
 */
export class StateManager {
  /**
   * Get the state file path for a project
   */
  getStatePath(projectPath: string): string {
    return join(projectPath, STATE_DIR, STATE_FILE_NAME);
  }

  /**
   * Get the .skillpkg directory path
   */
  getStateDir(projectPath: string): string {
    return join(projectPath, STATE_DIR);
  }

  /**
   * Check if state file exists
   */
  hasState(projectPath: string): boolean {
    return existsSync(this.getStatePath(projectPath));
  }

  /**
   * Load state from disk
   */
  async loadState(projectPath: string): Promise<State> {
    const statePath = this.getStatePath(projectPath);

    if (!existsSync(statePath)) {
      return createEmptyState();
    }

    try {
      const content = await readFile(statePath, 'utf-8');
      const state = JSON.parse(content) as State;

      // Validate schema version
      if (!state.$schema || !state.$schema.startsWith('skillpkg-state-')) {
        // Migrate from old format or return empty
        return createEmptyState();
      }

      // Ensure all fields exist
      return {
        $schema: state.$schema || STATE_SCHEMA_VERSION,
        skills: state.skills || {},
        mcp: state.mcp || {},
        sync_history: state.sync_history || {},
      };
    } catch {
      // If file is corrupted, return empty state
      return createEmptyState();
    }
  }

  /**
   * Save state to disk (atomic write)
   */
  async saveState(projectPath: string, state: State): Promise<void> {
    const statePath = this.getStatePath(projectPath);
    const stateDir = dirname(statePath);

    // Ensure directory exists
    await mkdir(stateDir, { recursive: true });

    // Write atomically
    const tempPath = `${statePath}.tmp`;
    const content = JSON.stringify(state, null, 2);

    await writeFile(tempPath, content, 'utf-8');

    // Rename temp to actual (atomic on most filesystems)
    const { rename } = await import('fs/promises');
    await rename(tempPath, statePath);
  }

  /**
   * Record a skill installation
   */
  async recordSkillInstall(
    projectPath: string,
    name: string,
    info: SkillInstallInfo
  ): Promise<void> {
    const state = await this.loadState(projectPath);

    state.skills[name] = {
      version: info.version,
      source: info.source,
      installed_by: info.installed_by,
      installed_at: new Date().toISOString(),
      depended_by: [],
    };

    await this.saveState(projectPath, state);
  }

  /**
   * Record a skill uninstallation
   */
  async recordSkillUninstall(projectPath: string, name: string): Promise<void> {
    const state = await this.loadState(projectPath);

    // Remove the skill
    delete state.skills[name];

    // Remove from depended_by of other skills
    for (const skillState of Object.values(state.skills)) {
      skillState.depended_by = skillState.depended_by.filter((dep) => dep !== name);
    }

    await this.saveState(projectPath, state);
  }

  /**
   * Record an MCP installation
   */
  async recordMcpInstall(
    projectPath: string,
    name: string,
    info: McpInstallInfo
  ): Promise<void> {
    const state = await this.loadState(projectPath);

    state.mcp[name] = {
      package: info.package,
      installed_by_skill: info.installed_by_skill,
      installed_at: new Date().toISOString(),
    };

    await this.saveState(projectPath, state);
  }

  /**
   * Record an MCP uninstallation
   */
  async recordMcpUninstall(projectPath: string, name: string): Promise<void> {
    const state = await this.loadState(projectPath);
    delete state.mcp[name];
    await this.saveState(projectPath, state);
  }

  /**
   * Add a dependency relationship (skill A depends on skill B)
   */
  async addDependency(
    projectPath: string,
    dependentSkill: string,
    dependencySkill: string
  ): Promise<void> {
    const state = await this.loadState(projectPath);

    if (!state.skills[dependencySkill]) {
      throw new Error(`Dependency skill not found: ${dependencySkill}`);
    }

    const depended_by = state.skills[dependencySkill].depended_by;
    if (!depended_by.includes(dependentSkill)) {
      depended_by.push(dependentSkill);
      await this.saveState(projectPath, state);
    }
  }

  /**
   * Remove a dependency relationship
   */
  async removeDependency(
    projectPath: string,
    dependentSkill: string,
    dependencySkill: string
  ): Promise<void> {
    const state = await this.loadState(projectPath);

    if (state.skills[dependencySkill]) {
      state.skills[dependencySkill].depended_by = state.skills[
        dependencySkill
      ].depended_by.filter((dep) => dep !== dependentSkill);
      await this.saveState(projectPath, state);
    }
  }

  /**
   * Get skills that depend on a given skill
   */
  getDependents(state: State, skillName: string): string[] {
    const skill = state.skills[skillName];
    return skill ? [...skill.depended_by] : [];
  }

  /**
   * Check if a skill can be safely uninstalled
   */
  canUninstall(state: State, skillName: string): UninstallCheck {
    const dependents = this.getDependents(state, skillName);
    return {
      canUninstall: dependents.length === 0,
      dependents,
    };
  }

  /**
   * Get orphan dependencies (skills installed as dependencies but no longer needed)
   */
  getOrphanDependencies(state: State): string[] {
    const orphans: string[] = [];

    for (const [name, skillState] of Object.entries(state.skills)) {
      // If installed by another skill (not user) and no one depends on it
      if (skillState.installed_by !== 'user' && skillState.depended_by.length === 0) {
        // Check if the skill that installed it still exists
        const installer = skillState.installed_by;
        if (!state.skills[installer]) {
          orphans.push(name);
        }
      }
    }

    return orphans;
  }

  /**
   * Get orphan state entries (skills in state but not on disk)
   * @param state - Current state
   * @param diskSkills - List of skill names that exist on disk
   */
  getOrphanStates(state: State, diskSkills: string[]): string[] {
    const diskSet = new Set(diskSkills);
    return Object.keys(state.skills).filter((name) => !diskSet.has(name));
  }

  /**
   * Clean orphan state entries (skills in state but not on disk)
   * Mirrors StoreManager.cleanOrphans() for consistency
   * @param projectPath - Project path
   * @param diskSkills - List of skill names that exist on disk
   * @returns List of removed skill names
   */
  async cleanOrphanStates(projectPath: string, diskSkills: string[]): Promise<string[]> {
    const state = await this.loadState(projectPath);
    const orphans = this.getOrphanStates(state, diskSkills);

    if (orphans.length > 0) {
      for (const name of orphans) {
        delete state.skills[name];
      }
      // Clean up depended_by references to orphans
      const orphanSet = new Set(orphans);
      for (const skillState of Object.values(state.skills)) {
        skillState.depended_by = skillState.depended_by.filter(
          (dep) => !orphanSet.has(dep)
        );
      }
      await this.saveState(projectPath, state);
    }

    return orphans;
  }

  /**
   * Clean dangling dependency references (depended_by pointing to non-existent skills)
   * @returns Number of references cleaned
   */
  async cleanDanglingReferences(projectPath: string): Promise<number> {
    const state = await this.loadState(projectPath);
    const existingSkills = new Set(Object.keys(state.skills));
    let cleanedCount = 0;

    for (const skillState of Object.values(state.skills)) {
      const before = skillState.depended_by.length;
      skillState.depended_by = skillState.depended_by.filter((dep) =>
        existingSkills.has(dep)
      );
      cleanedCount += before - skillState.depended_by.length;
    }

    if (cleanedCount > 0) {
      await this.saveState(projectPath, state);
    }

    return cleanedCount;
  }

  /**
   * Record a sync operation
   */
  async recordSync(projectPath: string, target: SyncTarget): Promise<void> {
    const state = await this.loadState(projectPath);
    state.sync_history[target] = new Date().toISOString();
    await this.saveState(projectPath, state);
  }

  /**
   * Get last sync time for a target
   */
  getLastSync(state: State, target: SyncTarget): string | null {
    return state.sync_history[target] || null;
  }

  /**
   * Get skill state
   */
  getSkillState(state: State, name: string): SkillState | null {
    return state.skills[name] || null;
  }

  /**
   * Get MCP state
   */
  getMcpState(state: State, name: string): McpState | null {
    return state.mcp[name] || null;
  }

  /**
   * Check if a skill is installed
   */
  isSkillInstalled(state: State, name: string): boolean {
    return name in state.skills;
  }

  /**
   * Check if an MCP is installed
   */
  isMcpInstalled(state: State, name: string): boolean {
    return name in state.mcp;
  }

  /**
   * Get all installed skill names
   */
  getInstalledSkills(state: State): string[] {
    return Object.keys(state.skills);
  }

  /**
   * Get all installed MCP names
   */
  getInstalledMcps(state: State): string[] {
    return Object.keys(state.mcp);
  }
}

/**
 * Create a StateManager instance
 */
export function createStateManager(): StateManager {
  return new StateManager();
}
