/**
 * Doctor module - Diagnose and repair skillpkg state
 *
 * Detects inconsistencies between:
 * - state.json (StateManager)
 * - registry.json (StoreManager)
 * - .skillpkg/skills/ directory (actual files)
 * - skillpkg.json (project config)
 *
 * This module reuses existing cleanup methods from StateManager and StoreManager
 * for consistency and to avoid duplicating logic.
 */
import type { StateManager } from '../state/index.js';
import type { ConfigManager } from '../config/index.js';
import type { StoreManager } from '../store/manager.js';
import type {
  DiagnosisResult,
  Issue,
  IssueSeverity,
  IssueType,
  RepairOptions,
  RepairResult,
  RepairAction,
} from './types.js';

/**
 * Doctor class - diagnoses and repairs skillpkg state
 *
 * Leverages existing methods:
 * - StateManager.getOrphanStates() - detect orphan state entries
 * - StateManager.cleanOrphanStates() - remove orphan state entries
 * - StateManager.cleanDanglingReferences() - clean dangling deps
 * - StoreManager.cleanOrphans() - remove orphan registry entries
 */
export class Doctor {
  private stateManager: StateManager;
  private configManager: ConfigManager;
  private storeManager: StoreManager;

  constructor(
    stateManager: StateManager,
    configManager: ConfigManager,
    storeManager: StoreManager
  ) {
    this.stateManager = stateManager;
    this.configManager = configManager;
    this.storeManager = storeManager;
  }

  /**
   * Diagnose the current state
   * Uses StateManager.getOrphanStates() for consistency with existing API
   */
  async diagnose(projectPath: string): Promise<DiagnosisResult> {
    const issues: Issue[] = [];

    // Load all data sources
    const state = await this.stateManager.loadState(projectPath);
    const registry = await this.storeManager.getRegistry();
    const config = await this.configManager.loadProjectConfig(projectPath);
    const diskSkills = await this.storeManager.getSkillNames();

    // Get skill sets
    const stateSkills = new Set(Object.keys(state.skills));
    const registrySkills = new Set(Object.keys(registry.skills));
    const diskSkillSet = new Set(diskSkills);
    const configSkills = new Set(config?.skills ? Object.keys(config.skills) : []);

    // Check 1: Skills in state but not on disk (orphan_state)
    // Uses StateManager.getOrphanStates() for consistency
    const orphanStates = this.stateManager.getOrphanStates(state, diskSkills);
    for (const skillName of orphanStates) {
      issues.push(this.createIssue(
        'orphan_state',
        'error',
        skillName,
        `Skill "${skillName}" is in state.json but has no files on disk`,
        'Remove from state.json',
        true
      ));
    }

    // Check 2: Skills in registry but not on disk (orphan_registry)
    // These will be cleaned by StoreManager.cleanOrphans()
    for (const skillName of registrySkills) {
      if (!diskSkillSet.has(skillName)) {
        issues.push(this.createIssue(
          'orphan_registry',
          'error',
          skillName,
          `Skill "${skillName}" is in registry.json but has no files on disk`,
          'Remove from registry.json',
          true
        ));
      }
    }

    // Check 3: Skills on disk but not in registry (orphan_disk)
    for (const skillName of diskSkillSet) {
      if (!registrySkills.has(skillName)) {
        issues.push(this.createIssue(
          'orphan_disk',
          'warning',
          skillName,
          `Skill "${skillName}" exists on disk but not in registry.json`,
          'Add to registry.json or remove from disk',
          true
        ));
      }
    }

    // Check 4: Invalid skill names (contains path separators)
    for (const skillName of [...stateSkills, ...registrySkills]) {
      if (skillName.includes('/') || skillName.includes('\\')) {
        issues.push(this.createIssue(
          'invalid_skill_name',
          'error',
          skillName,
          `Skill name "${skillName}" contains path separators`,
          'Reinstall with correct name from SKILL.md frontmatter',
          true
        ));
      }
    }

    // Check 5: State-Registry version mismatch
    for (const skillName of stateSkills) {
      if (registrySkills.has(skillName)) {
        const stateVersion = state.skills[skillName].version;
        const registryVersion = registry.skills[skillName].version;
        if (stateVersion !== registryVersion) {
          issues.push(this.createIssue(
            'state_registry_mismatch',
            'warning',
            skillName,
            `Version mismatch: state=${stateVersion}, registry=${registryVersion}`,
            'Update to latest version',
            true
          ));
        }
      }
    }

    // Check 6: User-installed skills not in skillpkg.json
    if (config) {
      for (const [skillName, skillState] of Object.entries(state.skills)) {
        if (skillState.installed_by === 'user' && !configSkills.has(skillName)) {
          issues.push(this.createIssue(
            'missing_skillpkg_entry',
            'info',
            skillName,
            `User-installed skill "${skillName}" is not in skillpkg.json`,
            'Add to skillpkg.json for team sharing',
            false
          ));
        }
      }
    }

    // Check 7: Dangling dependency references
    // Check depended_by arrays for references to non-existent skills
    for (const [skillName, skillState] of Object.entries(state.skills)) {
      if (skillState.depended_by) {
        for (const dependent of skillState.depended_by) {
          if (!stateSkills.has(dependent)) {
            issues.push(this.createIssue(
              'dangling_dependency',
              'warning',
              skillName,
              `Skill "${skillName}" has dangling dependency reference to "${dependent}"`,
              'Clean up dependency references',
              true
            ));
          }
        }
      }
    }

    // Check 8: Orphan dependencies (using existing StateManager method)
    // Skills installed as dependencies but their installer no longer exists
    const orphanDeps = this.stateManager.getOrphanDependencies(state);
    for (const skillName of orphanDeps) {
      // Only add if not already reported as orphan_state
      if (!orphanStates.includes(skillName)) {
        issues.push(this.createIssue(
          'orphan_dependency',
          'warning',
          skillName,
          `Skill "${skillName}" was installed as a dependency but is no longer needed`,
          'Remove unused dependency',
          true
        ));
      }
    }

    // Count synced skills
    let syncedCount = 0;
    for (const skillName of registrySkills) {
      const entry = registry.skills[skillName];
      if (entry.syncedPlatforms && entry.syncedPlatforms.length > 0) {
        syncedCount++;
      }
    }

    return {
      healthy: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      stats: {
        stateCount: stateSkills.size,
        registryCount: registrySkills.size,
        diskCount: diskSkillSet.size,
        syncedCount,
      },
    };
  }

  /**
   * Repair detected issues
   *
   * Uses batch operations from existing managers for efficiency:
   * - StateManager.cleanOrphanStates() for orphan_state issues
   * - StoreManager.cleanOrphans() for orphan_registry issues
   * - StateManager.cleanDanglingReferences() for dangling_dependency issues
   */
  async repair(projectPath: string, options: RepairOptions = {}): Promise<RepairResult> {
    const result: RepairResult = {
      success: true,
      actions: [],
      errors: [],
      issuesFixed: 0,
      issuesRemaining: 0,
    };

    // First, diagnose
    const diagnosis = await this.diagnose(projectPath);

    // Filter issues based on options
    const issuesToFix = options.autoOnly
      ? diagnosis.issues.filter(i => i.autoFixable)
      : diagnosis.issues;

    if (options.dryRun) {
      // Just report what would be done
      for (const issue of issuesToFix) {
        const action = this.getRepairAction(issue);
        if (action) {
          result.actions.push(action);
        }
      }
      result.issuesRemaining = diagnosis.issues.length;
      return result;
    }

    // Use batch operations where possible for efficiency
    if (options.removeOrphans !== false) {
      // Batch clean orphan registry entries using StoreManager.cleanOrphans()
      const orphanRegistryIssues = issuesToFix.filter(i => i.type === 'orphan_registry');
      if (orphanRegistryIssues.length > 0) {
        try {
          const cleaned = await this.storeManager.cleanOrphans();
          for (const name of cleaned) {
            result.issuesFixed++;
            result.actions.push({
              type: 'remove_registry',
              skillName: name,
              description: `Remove "${name}" from registry.json`,
            });
          }
        } catch (error) {
          result.errors.push(
            `Failed to clean orphan registry entries: ${error instanceof Error ? error.message : String(error)}`
          );
          result.success = false;
        }
      }

      // Batch clean orphan state entries using StateManager.cleanOrphanStates()
      const orphanStateIssues = issuesToFix.filter(i => i.type === 'orphan_state');
      if (orphanStateIssues.length > 0) {
        try {
          const diskSkills = await this.storeManager.getSkillNames();
          const cleaned = await this.stateManager.cleanOrphanStates(projectPath, diskSkills);
          for (const name of cleaned) {
            result.issuesFixed++;
            result.actions.push({
              type: 'remove_state',
              skillName: name,
              description: `Remove "${name}" from state.json`,
            });
          }
        } catch (error) {
          result.errors.push(
            `Failed to clean orphan state entries: ${error instanceof Error ? error.message : String(error)}`
          );
          result.success = false;
        }
      }

      // Batch clean dangling references using StateManager.cleanDanglingReferences()
      const danglingIssues = issuesToFix.filter(i => i.type === 'dangling_dependency');
      if (danglingIssues.length > 0) {
        try {
          const cleanedCount = await this.stateManager.cleanDanglingReferences(projectPath);
          if (cleanedCount > 0) {
            result.issuesFixed += danglingIssues.length;
            for (const issue of danglingIssues) {
              result.actions.push({
                type: 'update_state',
                skillName: issue.skillName,
                description: `Clean dependency references for "${issue.skillName}"`,
              });
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to clean dangling references: ${error instanceof Error ? error.message : String(error)}`
          );
          result.success = false;
        }
      }
    }

    // Handle remaining issues individually
    const handledTypes = new Set(['orphan_registry', 'orphan_state', 'dangling_dependency']);
    const remainingIssues = issuesToFix.filter(i => !handledTypes.has(i.type));

    for (const issue of remainingIssues) {
      if (!issue.autoFixable && options.autoOnly) {
        result.issuesRemaining++;
        continue;
      }

      try {
        const fixed = await this.fixIssue(projectPath, issue, options);
        if (fixed) {
          result.issuesFixed++;
          const action = this.getRepairAction(issue);
          if (action) {
            result.actions.push(action);
          }
        } else {
          result.issuesRemaining++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to fix ${issue.type} for ${issue.skillName}: ${error instanceof Error ? error.message : String(error)}`
        );
        result.success = false;
        result.issuesRemaining++;
      }
    }

    return result;
  }

  /**
   * Fix a single issue
   */
  private async fixIssue(
    projectPath: string,
    issue: Issue,
    options: RepairOptions
  ): Promise<boolean> {
    switch (issue.type) {
      case 'orphan_state':
        if (options.removeOrphans !== false) {
          // Remove from state.json
          await this.stateManager.recordSkillUninstall(projectPath, issue.skillName);
          return true;
        }
        return false;

      case 'orphan_registry':
        if (options.removeOrphans !== false) {
          // Remove from registry.json
          const registry = await this.storeManager.getRegistry();
          delete registry.skills[issue.skillName];
          await this.storeManager.saveRegistry(registry);
          return true;
        }
        return false;

      case 'orphan_disk':
        if (options.removeOrphans !== false) {
          // Add to registry from disk (or remove, depending on preference)
          // For now, we'll remove the orphan directory
          await this.storeManager.removeSkill(issue.skillName);
          return true;
        }
        return false;

      case 'invalid_skill_name':
        if (options.removeOrphans !== false) {
          // Remove entries with invalid names
          const state = await this.stateManager.loadState(projectPath);
          if (state.skills[issue.skillName]) {
            await this.stateManager.recordSkillUninstall(projectPath, issue.skillName);
          }
          const registry = await this.storeManager.getRegistry();
          if (registry.skills[issue.skillName]) {
            delete registry.skills[issue.skillName];
            await this.storeManager.saveRegistry(registry);
          }
          return true;
        }
        return false;

      case 'state_registry_mismatch':
        // Sync state version to registry version
        const registry = await this.storeManager.getRegistry();
        const registryEntry = registry.skills[issue.skillName];
        if (registryEntry) {
          const state = await this.stateManager.loadState(projectPath);
          state.skills[issue.skillName].version = registryEntry.version;
          await this.stateManager.saveState(projectPath, state);
          return true;
        }
        return false;

      case 'dangling_dependency':
        // Handled by batch operation (cleanDanglingReferences), but keep as fallback
        const currentState = await this.stateManager.loadState(projectPath);
        const skillState = currentState.skills[issue.skillName];
        if (skillState && skillState.depended_by) {
          skillState.depended_by = skillState.depended_by.filter(
            dep => currentState.skills[dep] !== undefined
          );
          await this.stateManager.saveState(projectPath, currentState);
          return true;
        }
        return false;

      case 'orphan_dependency':
        // Remove skill that was installed as dependency but is no longer needed
        if (options.removeOrphans !== false) {
          await this.storeManager.removeSkill(issue.skillName);
          await this.stateManager.recordSkillUninstall(projectPath, issue.skillName);
          return true;
        }
        return false;

      case 'missing_skillpkg_entry':
        // This is informational, don't auto-fix
        return false;

      case 'sync_outdated':
        if (options.resync) {
          // Would need Syncer to fix this
          return false;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get repair action for an issue
   */
  private getRepairAction(issue: Issue): RepairAction | null {
    switch (issue.type) {
      case 'orphan_state':
        return {
          type: 'remove_state',
          skillName: issue.skillName,
          description: `Remove "${issue.skillName}" from state.json`,
        };
      case 'orphan_registry':
        return {
          type: 'remove_registry',
          skillName: issue.skillName,
          description: `Remove "${issue.skillName}" from registry.json`,
        };
      case 'orphan_disk':
        return {
          type: 'remove_registry',
          skillName: issue.skillName,
          description: `Remove orphan skill directory "${issue.skillName}"`,
        };
      case 'invalid_skill_name':
        return {
          type: 'remove_state',
          skillName: issue.skillName,
          description: `Remove invalid skill name "${issue.skillName}"`,
        };
      case 'state_registry_mismatch':
        return {
          type: 'update_state',
          skillName: issue.skillName,
          description: `Sync version for "${issue.skillName}"`,
        };
      case 'dangling_dependency':
        return {
          type: 'update_state',
          skillName: issue.skillName,
          description: `Clean dependency references for "${issue.skillName}"`,
        };
      case 'orphan_dependency':
        return {
          type: 'remove_state',
          skillName: issue.skillName,
          description: `Remove unused dependency "${issue.skillName}"`,
        };
      default:
        return null;
    }
  }

  /**
   * Create an issue object
   */
  private createIssue(
    type: IssueType,
    severity: IssueSeverity,
    skillName: string,
    message: string,
    suggestion: string,
    autoFixable: boolean
  ): Issue {
    return {
      type,
      severity,
      skillName,
      message,
      suggestion,
      autoFixable,
    };
  }
}

/**
 * Create a Doctor instance
 */
export function createDoctor(
  stateManager: StateManager,
  configManager: ConfigManager,
  storeManager: StoreManager
): Doctor {
  return new Doctor(stateManager, configManager, storeManager);
}
