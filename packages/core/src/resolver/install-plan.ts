/**
 * InstallPlan - Prepare installation plan from resolved dependencies
 *
 * This module bridges the gap between DependencyResolver and the actual
 * installation process. It creates a plan that can be executed by the installer.
 */
import type { ResolutionResult } from './types.js';
import type { StateManager, InstalledBy } from '../state/index.js';

/**
 * A single step in the install plan
 */
export interface InstallStep {
  /** Skill name */
  name: string;
  /** Source to install from (github:user/repo, URL, etc.) */
  source: string;
  /** Whether this is a transitive dependency */
  isTransitive: boolean;
  /** The skill that requires this dependency (for transitive deps) */
  requiredBy?: string;
  /** Action to take */
  action: 'install' | 'skip';
  /** Reason for skipping (if action is 'skip') */
  skipReason?: string;
}

/**
 * MCP dependency that needs attention
 */
export interface McpRequirement {
  /** MCP server name */
  name: string;
  /** Skills that require this MCP */
  requiredBy: string[];
}

/**
 * Complete installation plan
 */
export interface InstallPlan {
  /** Steps to execute in order */
  steps: InstallStep[];
  /** MCP servers that need to be installed */
  mcpRequirements: McpRequirement[];
  /** Whether there were any errors during planning */
  hasErrors: boolean;
  /** Error messages */
  errors: string[];
  /** Circular dependency chain if detected */
  circularChain?: string[];
}

/**
 * Result of executing an install step
 */
export interface InstallStepResult {
  step: InstallStep;
  success: boolean;
  error?: string;
  /** Version that was installed */
  version?: string;
}

/**
 * Result of executing the full install plan
 */
export interface InstallPlanResult {
  /** Successfully installed skills */
  installed: InstallStepResult[];
  /** Failed installations */
  failed: InstallStepResult[];
  /** Skipped skills */
  skipped: InstallStep[];
  /** MCP requirements (not auto-installed) */
  mcpRequirements: McpRequirement[];
  /** Overall success */
  success: boolean;
}

/**
 * Create an install plan from resolution result
 */
export function createInstallPlan(
  resolution: ResolutionResult,
  installedSkills: Set<string> = new Set()
): InstallPlan {
  const plan: InstallPlan = {
    steps: [],
    mcpRequirements: [],
    hasErrors: resolution.errors.length > 0,
    errors: [...resolution.errors],
  };

  // Check for circular dependencies
  if (resolution.circularChain) {
    plan.circularChain = resolution.circularChain;
    plan.hasErrors = true;
    return plan;
  }

  // Build install steps from resolved dependencies
  // Dependencies are already in topological order (deps first)
  for (const dep of resolution.dependencies) {
    if (installedSkills.has(dep.name)) {
      plan.steps.push({
        name: dep.name,
        source: dep.source,
        isTransitive: dep.transitive,
        requiredBy: dep.requiredBy,
        action: 'skip',
        skipReason: 'Already installed',
      });
    } else {
      plan.steps.push({
        name: dep.name,
        source: dep.source,
        isTransitive: dep.transitive,
        requiredBy: dep.requiredBy,
        action: 'install',
      });
    }
  }

  // Build MCP requirements list
  // Note: Detailed requiredBy info will be filled by installer with more context
  for (const mcp of resolution.mcpToInstall) {
    plan.mcpRequirements.push({
      name: mcp,
      requiredBy: [],
    });
  }

  return plan;
}

/**
 * Record dependencies in state after successful installation
 *
 * Call this after each skill is successfully installed to update
 * the dependency tracking in state.
 *
 * @param projectPath - Path to the project root
 * @param stateManager - StateManager instance
 * @param step - The install step that was completed
 * @param version - Version that was installed
 */
export async function recordDependencyInstall(
  projectPath: string,
  stateManager: StateManager,
  step: InstallStep,
  version: string
): Promise<void> {
  // Determine who installed this skill
  // InstalledBy is 'user' or the name of the skill that depends on it
  const installedBy: InstalledBy = step.isTransitive
    ? step.requiredBy!
    : 'user';

  // Record the skill installation
  await stateManager.recordSkillInstall(projectPath, step.name, {
    version,
    source: step.source,
    installed_by: installedBy,
  });

  // If this is a transitive dependency, record the dependency relationship
  // addDependency(projectPath, dependentSkill, dependencySkill)
  // dependentSkill is the skill that DEPENDS on dependencySkill
  // So requiredBy (main-skill) depends on step.name (dep-skill)
  if (step.isTransitive && step.requiredBy) {
    await stateManager.addDependency(projectPath, step.requiredBy, step.name);
  }
}

/**
 * Get skills that would be installed (excluding skipped)
 */
export function getSkillsToInstall(plan: InstallPlan): InstallStep[] {
  return plan.steps.filter((s) => s.action === 'install');
}

/**
 * Get count of skills to install
 */
export function getInstallCount(plan: InstallPlan): number {
  return plan.steps.filter((s) => s.action === 'install').length;
}

/**
 * Check if plan has any MCP requirements
 */
export function hasMcpRequirements(plan: InstallPlan): boolean {
  return plan.mcpRequirements.length > 0;
}

/**
 * Format plan for display
 */
export function formatInstallPlan(plan: InstallPlan): string {
  const lines: string[] = [];

  if (plan.circularChain) {
    lines.push(`Circular dependency detected: ${plan.circularChain.join(' → ')}`);
    return lines.join('\n');
  }

  const toInstall = getSkillsToInstall(plan);
  const toSkip = plan.steps.filter((s) => s.action === 'skip');

  if (toInstall.length > 0) {
    lines.push('Skills to install:');
    for (const step of toInstall) {
      const suffix = step.isTransitive ? ` (required by ${step.requiredBy})` : '';
      lines.push(`  + ${step.name}${suffix}`);
    }
  }

  if (toSkip.length > 0) {
    lines.push('Skills already installed:');
    for (const step of toSkip) {
      lines.push(`  = ${step.name}`);
    }
  }

  if (plan.mcpRequirements.length > 0) {
    lines.push('MCP servers required:');
    for (const mcp of plan.mcpRequirements) {
      lines.push(`  ! ${mcp.name}`);
    }
  }

  if (plan.errors.length > 0) {
    lines.push('Errors:');
    for (const error of plan.errors) {
      lines.push(`  - ${error}`);
    }
  }

  return lines.join('\n');
}
