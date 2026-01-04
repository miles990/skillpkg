/**
 * Installer - Dependency-aware skill installation
 *
 * Integrates DependencyResolver, StateManager, StoreManager to provide
 * a complete installation experience with dependency tracking.
 */
import type { StateManager } from '../state/index.js';
import type { ConfigManager } from '../config/index.js';
import type { StoreManager } from '../store/store-manager.js';
import type { SkillFetcher } from '../resolver/types.js';
import {
  DependencyResolver,
  createInstallPlan,
  recordDependencyInstall,
  getSkillsToInstall,
  hasMcpRequirements,
} from '../resolver/index.js';
import type {
  InstallOptions,
  InstallResult,
  SkillInstallResult,
  UninstallOptions,
  UninstallResult,
  InstallerUninstallCheck,
  SkillFetcherAdapter,
  InstallFromConfigResult,
} from './types.js';

/**
 * Installer class - orchestrates skill installation with dependency resolution
 */
export class Installer {
  private stateManager: StateManager;
  private configManager: ConfigManager;
  private storeManager: StoreManager;
  private fetcher: SkillFetcherAdapter;
  private resolver: DependencyResolver;

  constructor(
    stateManager: StateManager,
    configManager: ConfigManager,
    storeManager: StoreManager,
    fetcher: SkillFetcherAdapter
  ) {
    this.stateManager = stateManager;
    this.configManager = configManager;
    this.storeManager = storeManager;
    this.fetcher = fetcher;

    // Create resolver with adapter
    this.resolver = new DependencyResolver(this.createResolverFetcher());
  }

  /**
   * Create a SkillFetcher compatible with DependencyResolver
   */
  private createResolverFetcher(): SkillFetcher {
    return {
      fetchMetadata: async (source: string) => {
        const meta = await this.fetcher.fetchMetadata(source);
        if (!meta) return null;
        return {
          name: meta.name,
          version: meta.version,
          dependencies: meta.dependencies,
        };
      },
    };
  }

  /**
   * Install a skill with all its dependencies
   */
  async install(
    projectPath: string,
    source: string,
    options: InstallOptions = {}
  ): Promise<InstallResult> {
    const result: InstallResult = {
      success: true,
      skills: [],
      mcpRequired: [],
      errors: [],
      stats: {
        installed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    };

    try {
      // Step 1: Resolve dependencies (unless skipped)
      let resolution;
      if (options.skipDependencies) {
        // Skip dependency resolution, install only the requested skill
        const meta = await this.fetcher.fetchMetadata(source);
        if (!meta) {
          result.success = false;
          result.errors.push(`Failed to fetch skill metadata from: ${source}`);
          return result;
        }
        resolution = {
          dependencies: [
            { name: meta.name, source, type: 'skill' as const, transitive: false },
          ],
          mcpToInstall: meta.dependencies?.mcp || [],
          errors: [],
        };
      } else {
        resolution = await this.resolver.resolveDependencies(source);
      }

      // Check for circular dependencies
      if (resolution.circularChain) {
        result.success = false;
        result.errors.push(
          `Circular dependency detected: ${resolution.circularChain.join(' → ')}`
        );
        return result;
      }

      // Check for resolution errors
      if (resolution.errors.length > 0) {
        result.errors.push(...resolution.errors);

        // If there were errors and no dependencies were resolved,
        // the resolution failed entirely
        if (resolution.dependencies.length === 0) {
          result.success = false;
          return result;
        }
      }

      // Step 2: Get currently installed skills
      const state = await this.stateManager.loadState(projectPath);
      const installedSkills = new Set(Object.keys(state.skills));

      // Step 3: Create install plan
      const plan = createInstallPlan(resolution, installedSkills);

      // If plan has errors, return early
      if (plan.hasErrors && plan.circularChain) {
        result.success = false;
        return result;
      }

      // Step 4: Execute installation (dry run check)
      if (options.dryRun) {
        // In dry run, just report what would be installed
        for (const step of plan.steps) {
          result.skills.push({
            name: step.name,
            version: '?.?.?', // Version unknown in dry run
            success: true,
            action: step.action === 'skip' ? 'skipped' : 'installed',
            transitive: step.isTransitive,
            requiredBy: step.requiredBy,
          });
          if (step.action === 'skip') {
            result.stats.skipped++;
          } else {
            result.stats.installed++;
          }
        }
        result.mcpRequired = plan.mcpRequirements.map((m) => m.name);
        return result;
      }

      // Step 5: Install each skill in order (dependencies first)
      const skillsToInstall = getSkillsToInstall(plan);

      for (const step of skillsToInstall) {
        const skillResult = await this.installSingleSkill(projectPath, step.source, step);
        result.skills.push({
          ...skillResult,
          transitive: step.isTransitive,
          requiredBy: step.requiredBy,
        });

        if (skillResult.success) {
          if (skillResult.action === 'installed') {
            result.stats.installed++;
          } else if (skillResult.action === 'updated') {
            result.stats.updated++;
          }
        } else {
          result.stats.failed++;
          result.success = false;
          if (skillResult.error) {
            result.errors.push(skillResult.error);
          }
        }
      }

      // Record skipped skills
      for (const step of plan.steps.filter((s) => s.action === 'skip')) {
        result.skills.push({
          name: step.name,
          version: state.skills[step.name]?.version || 'unknown',
          success: true,
          action: 'skipped',
          transitive: step.isTransitive,
          requiredBy: step.requiredBy,
        });
        result.stats.skipped++;
      }

      // Step 6: Record MCP requirements
      if (hasMcpRequirements(plan)) {
        result.mcpRequired = plan.mcpRequirements.map((m) => m.name);
      }

      // Step 7: Update skillpkg.json if user-installed (not transitive)
      const rootSkill = skillsToInstall.find((s) => !s.isTransitive);
      if (rootSkill) {
        await this.configManager.addSkill(projectPath, rootSkill.name, source);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Install a single skill (without dependency resolution)
   */
  private async installSingleSkill(
    projectPath: string,
    source: string,
    step: { name: string; source: string; isTransitive: boolean; requiredBy?: string }
  ): Promise<SkillInstallResult> {
    try {
      // Fetch the full skill (with files)
      const fetchResult = await this.fetcher.fetchSkill(source);
      if (!fetchResult) {
        return {
          name: step.name,
          version: 'unknown',
          success: false,
          action: 'failed',
          error: `Failed to fetch skill from: ${source}`,
          transitive: step.isTransitive,
          requiredBy: step.requiredBy,
        };
      }

      const { skill, files } = fetchResult;

      // Check if already installed (use skill.name from metadata)
      const existing = await this.storeManager.getSkill(skill.name);
      const action: 'installed' | 'updated' = existing ? 'updated' : 'installed';

      // Add/update in store (with files)
      if (existing) {
        await this.storeManager.updateSkill(skill.name, skill);
      } else {
        await this.storeManager.addSkill(skill, {
          source: 'registry',
          sourceUrl: source,
          files,
        });
      }

      // Record in state (use skill.name from metadata for consistency)
      await recordDependencyInstall(projectPath, this.stateManager, {
        name: skill.name,
        source: step.source,
        isTransitive: step.isTransitive,
        requiredBy: step.requiredBy,
        action: 'install',
      }, skill.version);

      return {
        name: skill.name,
        version: skill.version,
        success: true,
        action,
        transitive: step.isTransitive,
        requiredBy: step.requiredBy,
      };
    } catch (error) {
      return {
        name: step.name,
        version: 'unknown',
        success: false,
        action: 'failed',
        error: error instanceof Error ? error.message : String(error),
        transitive: step.isTransitive,
        requiredBy: step.requiredBy,
      };
    }
  }

  /**
   * Uninstall a skill with dependency checking
   */
  async uninstall(
    projectPath: string,
    skillName: string,
    options: UninstallOptions = {}
  ): Promise<UninstallResult> {
    const result: UninstallResult = {
      success: true,
      removed: [],
      orphansRemoved: [],
      errors: [],
    };

    try {
      // Step 1: Check if skill exists
      const skill = await this.storeManager.getSkill(skillName);
      if (!skill) {
        result.success = false;
        result.errors.push(`Skill not found: ${skillName}`);
        return result;
      }

      // Step 2: Check for dependents (unless force)
      if (!options.force) {
        const state = await this.stateManager.loadState(projectPath);
        const check = this.stateManager.canUninstall(state, skillName);

        if (!check.canUninstall) {
          result.success = false;
          result.errors.push(
            `Cannot uninstall: ${skillName} is required by: ${check.dependents.join(', ')}`
          );
          return result;
        }
      }

      // Step 3: Dry run check
      if (options.dryRun) {
        result.removed.push(skillName);
        return result;
      }

      // Step 4: Remove from store
      const removed = await this.storeManager.removeSkill(skillName);
      if (!removed) {
        result.success = false;
        result.errors.push(`Failed to remove skill: ${skillName}`);
        return result;
      }

      // Step 5: Remove from state
      await this.stateManager.recordSkillUninstall(projectPath, skillName);
      result.removed.push(skillName);

      // Step 6: Remove from skillpkg.json
      await this.configManager.removeSkill(projectPath, skillName);

      // Step 7: Clean up orphan dependencies (if requested)
      if (options.removeOrphans) {
        const orphans = await this.cleanupOrphanDependencies(projectPath);
        result.orphansRemoved.push(...orphans);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Check if a skill can be uninstalled
   */
  async canUninstall(projectPath: string, skillName: string): Promise<InstallerUninstallCheck> {
    const state = await this.stateManager.loadState(projectPath);
    const check = this.stateManager.canUninstall(state, skillName);

    return {
      canUninstall: check.canUninstall,
      dependents: check.dependents,
    };
  }

  /**
   * Clean up orphan dependencies (dependencies no longer needed by any skill)
   */
  private async cleanupOrphanDependencies(projectPath: string): Promise<string[]> {
    const removed: string[] = [];
    const state = await this.stateManager.loadState(projectPath);

    // Find skills that were installed as dependencies but are no longer needed
    for (const [skillName, skillState] of Object.entries(state.skills)) {
      // Skip user-installed skills
      if (skillState.installed_by === 'user') continue;

      // Check if any skill still depends on this one
      const hasDependents = Object.values(state.skills).some(
        (s) => s.depended_by?.includes(skillName)
      );

      if (!hasDependents) {
        // This is an orphan - remove it
        await this.storeManager.removeSkill(skillName);
        await this.stateManager.recordSkillUninstall(projectPath, skillName);
        removed.push(skillName);
      }
    }

    return removed;
  }

  /**
   * Install all skills from skillpkg.json
   */
  async installFromConfig(
    projectPath: string,
    options: InstallOptions = {}
  ): Promise<InstallFromConfigResult> {
    const result: InstallFromConfigResult = {
      success: true,
      skills: [],
      mcpRequired: [],
      errors: [],
    };

    try {
      // Load config
      const config = await this.configManager.loadProjectConfig(projectPath);
      if (!config) {
        result.success = false;
        result.errors.push('No skillpkg.json found');
        return result;
      }

      // Get skills to install
      const skills = config.skills || {};
      if (Object.keys(skills).length === 0) {
        // No skills to install
        return result;
      }

      // Install each skill
      for (const [, source] of Object.entries(skills)) {
        const installResult = await this.install(projectPath, source, options);

        // Merge results
        result.skills.push(...installResult.skills);
        result.mcpRequired.push(
          ...installResult.mcpRequired.filter((m) => !result.mcpRequired.includes(m))
        );
        result.errors.push(...installResult.errors);

        if (!installResult.success) {
          result.success = false;
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }
}

/**
 * Create an Installer instance
 */
export function createInstaller(
  stateManager: StateManager,
  configManager: ConfigManager,
  storeManager: StoreManager,
  fetcher: SkillFetcherAdapter
): Installer {
  return new Installer(stateManager, configManager, storeManager, fetcher);
}
