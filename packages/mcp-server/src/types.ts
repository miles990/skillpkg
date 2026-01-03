/**
 * @skillpkg/mcp-server - Type Definitions
 *
 * Types for MCP Server tools and handlers.
 */

// ============================================================
// Common Types
// ============================================================

export type Scope = 'local' | 'global';
export type Source = 'all' | 'local' | 'github';
export type SourceType = 'github' | 'gist' | 'url' | 'local';
export type RecommendCriteria = 'auto' | 'popular' | 'highest_rated' | 'newest';

export interface Author {
  name: string;
  email?: string;
  url?: string;
}

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: Author | string;
  tags?: string[];
  rating?: number;
  downloads?: number;
  updatedAt?: string;
}

// ============================================================
// Tool Handler Interface
// ============================================================

export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: unknown): Promise<ToolResult>;
}

// ============================================================
// Tool: search_skills
// ============================================================

export interface SearchSkillsInput {
  query: string;
  source?: Source;
  limit?: number;
}

export interface SearchSkillResult {
  id: string;
  name: string;
  description: string;
  version: string;
  source: 'local' | 'github';
  installed: boolean;
  rating: number;
  downloads: number;
  updatedAt: string;
  tags: string[];
  relevanceScore: number;
}

export interface SearchSkillsOutput {
  results: SearchSkillResult[];
  total: number;
  query: string;
}

// ============================================================
// Tool: load_skill
// ============================================================

export interface LoadSkillInput {
  id: string;
}

export interface LoadSkillOutput {
  id: string;
  name: string;
  version: string;
  description: string;
  instructions: string;
  author?: Author;
}

// ============================================================
// Tool: install_skill
// ============================================================

export interface InstallSkillInput {
  source: string;
  scope?: Scope;
}

export interface InstallSkillOutput {
  success: boolean;
  skill: {
    id: string;
    name: string;
    version: string;
    source: string;
    installedAt: string;
  };
  message: string;
}

// ============================================================
// Tool: list_skills
// ============================================================

export interface ListSkillsInput {
  scope?: 'all' | Scope;
}

export interface ListSkillItem {
  id: string;
  name: string;
  description: string;
  version: string;
  scope: Scope;
  installedAt: string;
}

export interface ListSkillsOutput {
  skills: ListSkillItem[];
  total: number;
}

// ============================================================
// Tool: uninstall_skill
// ============================================================

export interface UninstallSkillInput {
  id: string;
  scope?: Scope;
}

export interface UninstallSkillOutput {
  success: boolean;
  message: string;
}

// ============================================================
// Tool: search_registry
// ============================================================

export interface SearchRegistryInput {
  query: string;
  limit?: number;
}

export interface SearchRegistryResult {
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
}

export interface SearchRegistryOutput {
  results: SearchRegistryResult[];
  total: number;
}

// ============================================================
// Tool: skill_info
// ============================================================

export interface SkillInfoInput {
  name: string;
}

export interface SkillInfoOutput {
  name: string;
  description: string;
  version: string;
  author: Author;
  repository?: string;
  license?: string;
  platforms?: string[];
  tags?: string[];
  readme?: string;
}

// ============================================================
// Tool: recommend_skill
// ============================================================

export interface RecommendSkillInput {
  query: string;
  criteria?: RecommendCriteria;
}

export interface RecommendedSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  rating: number;
  downloads: number;
  updatedAt: string;
  author: string;
  tags: string[];
}

export interface AlternativeSkill {
  name: string;
  description: string;
  rating: number;
}

export interface RecommendSkillOutput {
  recommendation: RecommendedSkill;
  reason: string;
  alternatives: AlternativeSkill[];
  installCommand: string;
}

// ============================================================
// Server Options
// ============================================================

export interface ServerOptions {
  scope?: Scope;
  projectPath?: string;
}

// ============================================================
// Error Types
// ============================================================

export class SkillNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill "${id}" not found`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillNotInstalledError extends Error {
  constructor(id: string) {
    super(`Skill "${id}" is not installed. Use install_skill to install it first.`);
    this.name = 'SkillNotInstalledError';
  }
}

export class RegistryUnavailableError extends Error {
  constructor(message?: string) {
    super(message || 'Registry is currently unavailable. Local operations still work.');
    this.name = 'RegistryUnavailableError';
  }
}

// InvalidSourceError is now imported from skillpkg-core
export { InvalidSourceError } from 'skillpkg-core';
