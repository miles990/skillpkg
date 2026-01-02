/**
 * DependencyResolver - Resolve skill and MCP dependencies
 */
import type {
  ResolvedDependency,
  DependencyNode,
  ResolutionResult,
  SkillFetcher,
  SkillMetadata,
} from './types.js';
import { normalizeDependencies, type SkillDependencies } from '../types.js';

/**
 * DependencyResolver class
 */
export class DependencyResolver {
  private fetcher: SkillFetcher;

  constructor(fetcher: SkillFetcher) {
    this.fetcher = fetcher;
  }

  /**
   * Resolve all dependencies for a skill source
   * Returns dependencies in topological order (dependencies first)
   */
  async resolveDependencies(
    skillSource: string,
    installed: Set<string> = new Set()
  ): Promise<ResolutionResult> {
    const result: ResolutionResult = {
      dependencies: [],
      mcpToInstall: [],
      errors: [],
    };

    const visited = new Set<string>();
    const inProgress = new Set<string>(); // For circular detection
    const resolved: ResolvedDependency[] = [];

    try {
      await this.resolveRecursive(
        skillSource,
        installed,
        visited,
        inProgress,
        resolved,
        result,
        null
      );

      // resolved is already in topological order (dependencies first)
      // because we push after processing all children (post-order traversal)
      result.dependencies = resolved;

      // Deduplicate MCP dependencies
      result.mcpToInstall = [...new Set(result.mcpToInstall)];
    } catch (error) {
      if (error instanceof CircularDependencyError) {
        result.circularChain = error.chain;
        result.errors.push(`Circular dependency detected: ${error.chain.join(' → ')}`);
      } else {
        result.errors.push(String(error));
      }
    }

    return result;
  }

  /**
   * Recursive dependency resolution with circular detection
   */
  private async resolveRecursive(
    source: string,
    installed: Set<string>,
    visited: Set<string>,
    inProgress: Set<string>,
    resolved: ResolvedDependency[],
    result: ResolutionResult,
    requiredBy: string | null
  ): Promise<void> {
    // Normalize source to skill name for deduplication
    const skillName = this.extractSkillName(source);

    // Skip if already installed
    if (installed.has(skillName)) {
      return;
    }

    // Skip if already resolved
    if (visited.has(skillName)) {
      return;
    }

    // Check for circular dependency
    if (inProgress.has(skillName)) {
      const chain = [...inProgress, skillName];
      throw new CircularDependencyError(chain);
    }

    // Mark as in progress
    inProgress.add(skillName);

    try {
      // Fetch skill metadata
      const metadata = await this.fetcher.fetchMetadata(source);

      if (!metadata) {
        result.errors.push(`Failed to fetch metadata for: ${source}`);
        return;
      }

      // Normalize dependencies
      const deps = normalizeDependencies(metadata.dependencies);

      // Process skill dependencies first (depth-first)
      for (const depSource of deps.skills || []) {
        await this.resolveRecursive(
          depSource,
          installed,
          visited,
          inProgress,
          resolved,
          result,
          skillName
        );
      }

      // Collect MCP dependencies
      for (const mcp of deps.mcp || []) {
        if (!result.mcpToInstall.includes(mcp)) {
          result.mcpToInstall.push(mcp);
        }
      }

      // Add this skill to resolved list
      resolved.push({
        name: skillName,
        source,
        type: 'skill',
        transitive: requiredBy !== null,
        requiredBy: requiredBy || undefined,
      });
    } finally {
      // Remove from in progress
      inProgress.delete(skillName);
      // Mark as visited
      visited.add(skillName);
    }
  }

  /**
   * Build a dependency tree for visualization
   */
  async buildDependencyTree(
    skillSource: string,
    installed: Set<string> = new Set()
  ): Promise<DependencyNode | null> {
    const visited = new Set<string>();
    return this.buildTreeRecursive(skillSource, installed, visited);
  }

  /**
   * Recursive tree building
   */
  private async buildTreeRecursive(
    source: string,
    installed: Set<string>,
    visited: Set<string>
  ): Promise<DependencyNode | null> {
    const skillName = this.extractSkillName(source);

    // Prevent infinite loops
    if (visited.has(skillName)) {
      return null;
    }
    visited.add(skillName);

    // Fetch metadata
    const metadata = await this.fetcher.fetchMetadata(source);
    if (!metadata) {
      return null;
    }

    const deps = normalizeDependencies(metadata.dependencies);
    const children: DependencyNode[] = [];

    // Recursively build children
    for (const depSource of deps.skills || []) {
      const child = await this.buildTreeRecursive(depSource, installed, visited);
      if (child) {
        children.push(child);
      }
    }

    return {
      name: metadata.name,
      version: metadata.version,
      source,
      dependencies: children,
      mcpDependencies: deps.mcp || [],
    };
  }

  /**
   * Detect circular dependencies
   * Returns the circular chain if found, null otherwise
   */
  async detectCircular(skillSource: string): Promise<string[] | null> {
    const result = await this.resolveDependencies(skillSource);
    return result.circularChain || null;
  }

  /**
   * Get direct dependencies (not transitive)
   */
  async getDirectDependencies(skillSource: string): Promise<SkillDependencies> {
    const metadata = await this.fetcher.fetchMetadata(skillSource);
    if (!metadata) {
      return { skills: [], mcp: [] };
    }
    return normalizeDependencies(metadata.dependencies);
  }

  /**
   * Extract skill name from source
   * e.g., "github:user/skill-name" -> "skill-name"
   */
  private extractSkillName(source: string): string {
    // GitHub format: github:user/repo
    if (source.startsWith('github:')) {
      const parts = source.replace('github:', '').split('/');
      return parts[parts.length - 1];
    }

    // URL format: https://github.com/user/repo
    if (source.startsWith('http://') || source.startsWith('https://')) {
      try {
        const url = new URL(source);
        const parts = url.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || source;
      } catch {
        return source;
      }
    }

    // Local path or skill name
    return source.split('/').pop() || source;
  }
}

/**
 * Circular dependency error
 */
export class CircularDependencyError extends Error {
  readonly chain: string[];

  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' → ')}`);
    this.name = 'CircularDependencyError';
    this.chain = chain;
  }
}

/**
 * Create a DependencyResolver instance
 */
export function createDependencyResolver(fetcher: SkillFetcher): DependencyResolver {
  return new DependencyResolver(fetcher);
}

/**
 * Create a mock fetcher for testing
 */
export function createMockFetcher(
  skills: Map<string, SkillMetadata>
): SkillFetcher {
  return {
    async fetchMetadata(source: string): Promise<SkillMetadata | null> {
      // Try exact match first
      if (skills.has(source)) {
        return skills.get(source) || null;
      }

      // Try by name
      for (const [key, metadata] of skills.entries()) {
        if (metadata.name === source || key.endsWith(`/${source}`)) {
          return metadata;
        }
      }

      return null;
    },
  };
}
