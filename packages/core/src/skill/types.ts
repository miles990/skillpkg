/**
 * Skill types for SKILL.md format
 */

/**
 * Structured triggers for skill matching engine
 */
export interface SkillTriggers {
  /** Keywords for matching */
  keywords?: {
    /** Primary keywords (weight: 1.0) - direct match triggers */
    primary?: string[];
    /** Secondary keywords (weight: 0.6) - candidate match */
    secondary?: string[];
  };
  /** Context words that boost score (+0.2 when co-occurring) */
  context_boost?: string[];
  /** Context words that reduce score (-0.3 when co-occurring) */
  context_penalty?: string[];
  /** Priority for tie-breaking (default: medium) */
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Skill frontmatter from SKILL.md
 * Compatible with Claude Code / superpowers minimal format (name + description only)
 */
export interface SkillFrontmatter {
  /** Unique skill identifier in kebab-case */
  name: string;
  /** Semantic version (e.g., "1.0.0") - optional, defaults to "1.0.0" */
  version?: string;
  /** Short description of the skill */
  description: string;
  /** Author name or object */
  author?: string;
  /** Keywords/tags for search */
  tags?: string[];
  /** Triggers for skill matching (string[] for legacy, SkillTriggers for new format) */
  triggers?: string[] | SkillTriggers;
  /** MCP dependencies */
  dependencies?: {
    /** Skill dependencies */
    skills?: string[];
    /** Software skill dependencies (for domain skills) */
    'software-skills'?: string[];
    /** MCP server dependencies */
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
  /** Custom instructions content (markdown) */
  instructions?: string;
  /** Whether to create a directory for the skill */
  createDir?: boolean;
  /** Target directory (defaults to cwd) */
  targetDir?: string;
}
