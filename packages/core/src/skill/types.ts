/**
 * Skill types for SKILL.md format
 */

/**
 * Skill frontmatter from SKILL.md
 */
export interface SkillFrontmatter {
  /** Unique skill identifier in kebab-case */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Short description of the skill */
  description: string;
  /** Author name or object */
  author?: string;
  /** Keywords/tags for search */
  tags?: string[];
  /** MCP dependencies */
  dependencies?: {
    mcp?: McpDependency[];
  };
}

/**
 * MCP server dependency
 */
export interface McpDependency {
  /** Display name */
  name: string;
  /** npm package name */
  package: string;
}

/**
 * Parsed SKILL.md content
 */
export interface ParsedSkill {
  /** Frontmatter metadata */
  metadata: SkillFrontmatter;
  /** Markdown content (without frontmatter) */
  content: string;
  /** Raw file content (with frontmatter) */
  rawContent: string;
  /** Path to SKILL.md file */
  filePath: string;
}

/**
 * Options for creating a new skill
 */
export interface CreateSkillOptions {
  /** Skill name (kebab-case) */
  name: string;
  /** Short description */
  description?: string;
  /** Whether to create a directory for the skill */
  createDir?: boolean;
  /** Target directory (defaults to cwd) */
  targetDir?: string;
}
