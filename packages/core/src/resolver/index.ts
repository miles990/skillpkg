/**
 * Resolver module - Dependency resolution for skills and MCPs
 *
 * @example
 * ```typescript
 * import { DependencyResolver, createDependencyResolver, createInstallPlan } from '@skillpkg/core';
 *
 * const fetcher = {
 *   async fetchMetadata(source) {
 *     // Fetch skill metadata from source
 *     return { name: 'my-skill', version: '1.0.0' };
 *   }
 * };
 *
 * const resolver = createDependencyResolver(fetcher);
 *
 * // Resolve all dependencies
 * const result = await resolver.resolveDependencies('github:user/my-skill');
 *
 * // Create install plan
 * const plan = createInstallPlan(result);
 * console.log(formatInstallPlan(plan));
 *
 * // Check for circular dependencies
 * const circular = await resolver.detectCircular('github:user/my-skill');
 * if (circular) {
 *   console.log('Circular dependency:', circular.join(' → '));
 * }
 * ```
 */

// Types
export type {
  ResolvedDependency,
  DependencyNode,
  ResolutionResult,
  McpResolutionResult,
  SkillFetcher,
  SkillMetadata,
} from './types.js';

// DependencyResolver
export {
  DependencyResolver,
  CircularDependencyError,
  createDependencyResolver,
  createMockFetcher,
} from './dependency-resolver.js';

// Install Plan
export type {
  InstallStep,
  McpRequirement,
  InstallPlan,
  InstallStepResult,
  InstallPlanResult,
} from './install-plan.js';

export {
  createInstallPlan,
  recordDependencyInstall,
  getSkillsToInstall,
  getInstallCount,
  hasMcpRequirements,
  formatInstallPlan,
} from './install-plan.js';
