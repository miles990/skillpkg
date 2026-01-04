/**
 * Syncer types - Sync skills to AI tool directories
 */
import type { SyncTarget } from '../config/types.js';

/**
 * Sync format type
 * - directory: Each skill as SKILL.md in its own directory
 * - single-file: All skills merged into one file
 */
export type SyncFormat = 'directory' | 'single-file';

/**
 * Frontmatter handling
 * - keep: Keep frontmatter as-is
 * - remove: Remove frontmatter from output
 * - convert: Convert to target-specific format
 */
export type FrontmatterHandling = 'keep' | 'remove' | 'convert';

/**
 * Target configuration
 */
export interface TargetConfig {
  /** Target identifier */
  id: SyncTarget;
  /** Display name */
  displayName: string;
  /** Sync format (directory or single-file) */
  format: SyncFormat;
  /** Output path relative to project root */
  outputPath: string;
  /** Skill file name (for directory format) */
  skillFileName: string;
  /** How to handle frontmatter */
  frontmatter: FrontmatterHandling;
  /** File extension */
  extension: '.md' | '.yaml';
  /** MCP config file path (relative to project root) */
  mcpConfigPath?: string;
  /** Whether this target is implemented in v2.0 */
  implemented: boolean;
  /** Description of the target */
  description: string;
}

/**
 * Target configurations for Agent Skills standard adopters
 *
 * All platforms use the open Agent Skills specification (SKILL.md format)
 * Reference: https://agentskills.io/specification
 *
 * Official adopters:
 * - Claude Code: https://code.claude.com/docs/en/skills
 * - Cursor: https://cursor.com/docs/context/skills
 * - OpenAI Codex: https://developers.openai.com/codex/skills/
 * - GitHub Copilot: https://code.visualstudio.com/docs/copilot/customization/agent-skills
 */
export const TARGET_CONFIGS: Record<SyncTarget, TargetConfig> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    format: 'directory',
    outputPath: '.claude/skills',
    skillFileName: 'SKILL.md',
    frontmatter: 'keep',
    extension: '.md',
    mcpConfigPath: '.mcp.json',
    implemented: true,
    description: 'Claude Code CLI skills directory (.claude/skills/)',
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    format: 'directory',
    outputPath: '.cursor/skills',
    skillFileName: 'SKILL.md',
    frontmatter: 'keep',
    extension: '.md',
    mcpConfigPath: undefined,
    implemented: true,
    description: 'Cursor IDE skills directory (.cursor/skills/)',
  },
  codex: {
    id: 'codex',
    displayName: 'OpenAI Codex',
    format: 'directory',
    outputPath: '.codex/skills',
    skillFileName: 'SKILL.md',
    frontmatter: 'keep',
    extension: '.md',
    mcpConfigPath: undefined,
    implemented: true,
    description: 'OpenAI Codex CLI skills directory (.codex/skills/)',
  },
  copilot: {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    format: 'directory',
    outputPath: '.github/skills',
    skillFileName: 'SKILL.md',
    frontmatter: 'keep',
    extension: '.md',
    mcpConfigPath: undefined,
    implemented: true,
    description: 'GitHub Copilot skills directory (.github/skills/)',
  },
};

/**
 * Get target config by ID
 */
export function getTargetConfig(target: SyncTarget): TargetConfig {
  return TARGET_CONFIGS[target];
}

/**
 * Get all implemented targets
 */
export function getImplementedTargets(): TargetConfig[] {
  return Object.values(TARGET_CONFIGS).filter((t) => t.implemented);
}

/**
 * Get all targets (including unimplemented)
 */
export function getAllTargets(): TargetConfig[] {
  return Object.values(TARGET_CONFIGS);
}

/**
 * Skill content for syncing
 */
export interface SkillContent {
  /** Skill name */
  name: string;
  /** Skill version */
  version: string;
  /** Raw content (with frontmatter) */
  rawContent: string;
  /** Content without frontmatter */
  bodyContent: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, unknown>;
  /** Source directory path (for copying additional files) */
  sourcePath?: string;
}

/**
 * Syncer options
 */
export interface SyncerOptions {
  /** Dry run mode (don't write files) */
  dryRun?: boolean;
  /** Force overwrite even if unchanged */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Single file sync result
 */
export interface FileSyncResult {
  /** File path relative to project */
  path: string;
  /** Action taken */
  action: 'created' | 'updated' | 'unchanged' | 'deleted' | 'skipped';
  /** Skill name (if applicable) */
  skillName?: string;
}

/**
 * Target sync result
 */
export interface TargetSyncResult {
  /** Target ID */
  target: SyncTarget;
  /** Whether sync was successful */
  success: boolean;
  /** Files synced */
  files: FileSyncResult[];
  /** Errors if any */
  errors: string[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Overall sync result
 */
export interface SyncerResult {
  /** Target results */
  targets: TargetSyncResult[];
  /** MCP config sync result */
  mcpConfig?: {
    path: string;
    action: 'created' | 'updated' | 'unchanged';
  };
  /** Overall success */
  success: boolean;
  /** Summary statistics */
  stats: {
    skillsSynced: number;
    filesCreated: number;
    filesUpdated: number;
    filesUnchanged: number;
    filesDeleted: number;
  };
}

/**
 * MCP configuration format for .mcp.json
 */
export interface McpJsonConfig {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
}
