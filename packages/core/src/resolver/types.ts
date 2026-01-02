/**
 * Dependency resolver types
 */

/**
 * Resolved dependency information
 */
export interface ResolvedDependency {
  /** Dependency name */
  name: string;
  /** Source (github:user/repo, URL, or local path) */
  source: string;
  /** Dependency type */
  type: 'skill' | 'mcp';
  /** Whether this is a transitive dependency */
  transitive: boolean;
  /** Original skill that requires this dependency (for transitive) */
  requiredBy?: string;
}

/**
 * Dependency tree node
 */
export interface DependencyNode {
  /** Skill name */
  name: string;
  /** Skill version */
  version: string;
  /** Source */
  source: string;
  /** Dependencies of this skill */
  dependencies: DependencyNode[];
  /** MCP dependencies */
  mcpDependencies: string[];
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** All resolved dependencies in installation order */
  dependencies: ResolvedDependency[];
  /** Circular dependency chain if detected */
  circularChain?: string[];
  /** MCP servers that need to be installed */
  mcpToInstall: string[];
  /** Errors during resolution */
  errors: string[];
}

/**
 * MCP resolution result
 */
export interface McpResolutionResult {
  /** MCPs already installed/configured */
  installed: string[];
  /** MCPs that need to be installed */
  needsInstall: string[];
  /** Unknown MCPs (not in registry) */
  unknown: string[];
}

/**
 * Skill metadata fetcher interface
 */
export interface SkillFetcher {
  /** Fetch skill metadata from source */
  fetchMetadata(source: string): Promise<SkillMetadata | null>;
}

/**
 * Minimal skill metadata for dependency resolution
 */
export interface SkillMetadata {
  name: string;
  version: string;
  dependencies?: {
    skills?: string[];
    mcp?: string[];
  };
}
