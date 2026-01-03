/**
 * Syncer - Sync skills to AI tool directories
 */
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import type { SyncTarget, SyncTargets, SkillpkgConfig, McpConfig } from '../config/types.js';
import type { StateManager } from '../state/index.js';
import type {
  TargetConfig,
  SkillContent,
  SyncerOptions,
  SyncerResult,
  TargetSyncResult,
  McpJsonConfig,
} from './types.js';
import { getTargetConfig } from './types.js';
import matter from 'gray-matter';

/**
 * Syncer class - syncs skills to AI tool directories
 */
export class Syncer {
  private stateManager?: StateManager;

  constructor(stateManager?: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Sync all skills to all enabled targets
   */
  async syncAll(
    projectPath: string,
    skills: Map<string, SkillContent>,
    config: SkillpkgConfig,
    options: SyncerOptions = {}
  ): Promise<SyncerResult> {
    const result: SyncerResult = {
      targets: [],
      success: true,
      stats: {
        skillsSynced: 0,
        filesCreated: 0,
        filesUpdated: 0,
        filesUnchanged: 0,
        filesDeleted: 0,
      },
    };

    // Get enabled targets
    const enabledTargets = this.getEnabledTargets(config.sync_targets);

    // Sync to each target
    for (const target of enabledTargets) {
      const targetConfig = getTargetConfig(target);

      // Skip unimplemented targets
      if (!targetConfig.implemented) {
        result.targets.push({
          target,
          success: false,
          files: [],
          errors: [`Target '${target}' is not yet implemented`],
          warnings: [],
        });
        continue;
      }

      const targetResult = await this.syncToTarget(
        projectPath,
        skills,
        targetConfig,
        options
      );

      result.targets.push(targetResult);

      if (!targetResult.success) {
        result.success = false;
      }

      // Aggregate stats
      for (const file of targetResult.files) {
        switch (file.action) {
          case 'created':
            result.stats.filesCreated++;
            break;
          case 'updated':
            result.stats.filesUpdated++;
            break;
          case 'unchanged':
            result.stats.filesUnchanged++;
            break;
          case 'deleted':
            result.stats.filesDeleted++;
            break;
        }
      }
    }

    result.stats.skillsSynced = skills.size;

    // Sync MCP config if applicable
    if (config.mcp && Object.keys(config.mcp).length > 0) {
      const mcpResult = await this.syncMcpConfig(projectPath, config.mcp, options);
      result.mcpConfig = mcpResult;
    }

    // Update sync history in state
    if (this.stateManager && !options.dryRun) {
      for (const targetResult of result.targets) {
        if (targetResult.success) {
          await this.stateManager.recordSync(projectPath, targetResult.target);
        }
      }
    }

    return result;
  }

  /**
   * Sync skills to a single target
   */
  async syncToTarget(
    projectPath: string,
    skills: Map<string, SkillContent>,
    targetConfig: TargetConfig,
    options: SyncerOptions = {}
  ): Promise<TargetSyncResult> {
    const result: TargetSyncResult = {
      target: targetConfig.id,
      success: true,
      files: [],
      errors: [],
      warnings: [],
    };

    try {
      const outputDir = join(projectPath, targetConfig.outputPath);

      // Ensure output directory exists
      if (!options.dryRun) {
        await mkdir(outputDir, { recursive: true });
      }

      if (targetConfig.format === 'directory') {
        // Directory format: each skill in its own directory
        await this.syncDirectoryFormat(
          projectPath,
          outputDir,
          skills,
          targetConfig,
          result,
          options
        );
      } else {
        // Single-file format: all skills merged into one file
        await this.syncSingleFileFormat(
          projectPath,
          outputDir,
          skills,
          targetConfig,
          result,
          options
        );
      }

      // Clean up orphaned skill directories (only for directory format)
      if (targetConfig.format === 'directory' && !options.dryRun) {
        await this.cleanupOrphans(outputDir, skills, targetConfig, result);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Sync in directory format (each skill in its own directory)
   */
  private async syncDirectoryFormat(
    projectPath: string,
    outputDir: string,
    skills: Map<string, SkillContent>,
    targetConfig: TargetConfig,
    result: TargetSyncResult,
    options: SyncerOptions
  ): Promise<void> {
    for (const [name, skill] of skills) {
      const skillDir = join(outputDir, name);
      const skillFile = join(skillDir, targetConfig.skillFileName);
      const relativePath = relative(projectPath, skillFile);

      // Transform content for target
      const content = this.transformForTarget(skill, targetConfig);

      // Check if file needs updating
      const action = await this.getFileAction(skillFile, content, options);

      if (action === 'unchanged') {
        result.files.push({ path: relativePath, action, skillName: name });
        continue;
      }

      if (!options.dryRun) {
        await mkdir(skillDir, { recursive: true });
        await writeFile(skillFile, content, 'utf-8');
      }

      result.files.push({ path: relativePath, action, skillName: name });
    }
  }

  /**
   * Sync in single-file format (all skills merged)
   */
  private async syncSingleFileFormat(
    projectPath: string,
    outputDir: string,
    skills: Map<string, SkillContent>,
    targetConfig: TargetConfig,
    result: TargetSyncResult,
    options: SyncerOptions
  ): Promise<void> {
    const outputFile = join(outputDir, targetConfig.skillFileName);
    const relativePath = relative(projectPath, outputFile);

    // Merge all skills into one file
    const content = this.mergeSkillsForTarget(skills, targetConfig);

    // Check if file needs updating
    const action = await this.getFileAction(outputFile, content, options);

    if (action === 'unchanged') {
      result.files.push({ path: relativePath, action });
      return;
    }

    if (!options.dryRun) {
      await mkdir(outputDir, { recursive: true });
      await writeFile(outputFile, content, 'utf-8');
    }

    result.files.push({ path: relativePath, action });
  }

  /**
   * Transform skill content for a specific target
   */
  transformForTarget(skill: SkillContent, targetConfig: TargetConfig): string {
    switch (targetConfig.frontmatter) {
      case 'keep':
        return skill.rawContent;
      case 'remove':
        return skill.bodyContent;
      case 'convert':
        // Future: convert frontmatter to target-specific format
        return skill.bodyContent;
      default:
        return skill.rawContent;
    }
  }

  /**
   * Merge multiple skills into a single file
   */
  private mergeSkillsForTarget(
    skills: Map<string, SkillContent>,
    targetConfig: TargetConfig
  ): string {
    const sections: string[] = [];

    // Add header based on target
    if (targetConfig.id === 'codex') {
      sections.push('# AGENTS\n');
      sections.push('This file contains AI agent skills for this project.\n');
    } else if (targetConfig.id === 'copilot') {
      sections.push('# GitHub Copilot Instructions\n');
      sections.push('These are custom instructions for GitHub Copilot.\n');
    }

    // Add each skill as a section
    for (const [name, skill] of skills) {
      sections.push(`\n---\n`);
      sections.push(`## ${name} (v${skill.version})\n`);
      sections.push(skill.bodyContent);
    }

    return sections.join('\n');
  }

  /**
   * Cleanup orphaned skill directories
   */
  private async cleanupOrphans(
    outputDir: string,
    skills: Map<string, SkillContent>,
    targetConfig: TargetConfig,
    result: TargetSyncResult
  ): Promise<void> {
    if (!existsSync(outputDir)) return;

    try {
      const entries = await readdir(outputDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillName = entry.name;

        // Skip if skill exists in current list
        if (skills.has(skillName)) continue;

        // This is an orphan - delete it
        const skillDir = join(outputDir, skillName);
        const skillFile = join(skillDir, targetConfig.skillFileName);

        if (existsSync(skillFile)) {
          await unlink(skillFile);
          result.files.push({
            path: relative(outputDir, skillFile),
            action: 'deleted',
            skillName,
          });
        }

        // Try to remove empty directory
        try {
          const remaining = await readdir(skillDir);
          if (remaining.length === 0) {
            const { rmdir } = await import('fs/promises');
            await rmdir(skillDir);
          }
        } catch {
          // Ignore errors when removing directory
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Sync MCP configuration to .mcp.json
   */
  async syncMcpConfig(
    projectPath: string,
    mcpConfigs: Record<string, McpConfig>,
    options: SyncerOptions = {}
  ): Promise<{ path: string; action: 'created' | 'updated' | 'unchanged' }> {
    const mcpJsonPath = join(projectPath, '.mcp.json');
    const relativePath = '.mcp.json';

    // Build MCP JSON config
    const mcpJson: McpJsonConfig = {
      mcpServers: {},
    };

    for (const [name, config] of Object.entries(mcpConfigs)) {
      mcpJson.mcpServers[name] = {
        command: config.command || `npx ${config.package}`,
        args: config.args,
        env: config.env,
      };
    }

    const content = JSON.stringify(mcpJson, null, 2);
    const action = await this.getFileAction(mcpJsonPath, content, options);

    if (action !== 'unchanged' && !options.dryRun) {
      await writeFile(mcpJsonPath, content, 'utf-8');
    }

    return { path: relativePath, action };
  }

  /**
   * Determine what action is needed for a file
   */
  private async getFileAction(
    filePath: string,
    newContent: string,
    options: SyncerOptions
  ): Promise<'created' | 'updated' | 'unchanged'> {
    if (!existsSync(filePath)) {
      return 'created';
    }

    if (options.force) {
      return 'updated';
    }

    // Compare content hash
    try {
      const existingContent = await readFile(filePath, 'utf-8');
      const existingHash = this.hashContent(existingContent);
      const newHash = this.hashContent(newContent);

      return existingHash === newHash ? 'unchanged' : 'updated';
    } catch {
      return 'updated';
    }
  }

  /**
   * Hash content for comparison
   */
  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Get list of enabled targets from config
   */
  private getEnabledTargets(syncTargets?: SyncTargets): SyncTarget[] {
    if (!syncTargets) {
      // Default to claude-code only
      return ['claude-code'];
    }

    const enabled: SyncTarget[] = [];
    for (const [target, isEnabled] of Object.entries(syncTargets)) {
      if (isEnabled) {
        enabled.push(target as SyncTarget);
      }
    }

    return enabled.length > 0 ? enabled : ['claude-code'];
  }
}

/**
 * Create a Syncer instance
 */
export function createSyncer(stateManager?: StateManager): Syncer {
  return new Syncer(stateManager);
}

/**
 * Load skill content from a SKILL.md file
 *
 * Only supports SKILL.md format (Markdown with YAML frontmatter).
 * skill.yaml format is no longer supported.
 */
export async function loadSkillContent(filePath: string): Promise<SkillContent> {
  const rawContent = await readFile(filePath, 'utf-8');

  // Parse SKILL.md with gray-matter
  const { data, content } = matter(rawContent);

  return {
    name: (data.name as string) || 'unknown',
    version: (data.version as string) || '1.0.0',
    rawContent,
    bodyContent: content.trim() || rawContent,
    frontmatter: data as Record<string, unknown>,
  };
}

/**
 * Load all skills from a directory
 */
export async function loadSkillsFromDirectory(
  skillsDir: string
): Promise<Map<string, SkillContent>> {
  const skills = new Map<string, SkillContent>();

  if (!existsSync(skillsDir)) {
    return skills;
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = join(skillsDir, entry.name);
    const skillFile = join(skillDir, 'SKILL.md');

    if (!existsSync(skillFile)) continue;

    try {
      const skill = await loadSkillContent(skillFile);
      skills.set(entry.name, skill);
    } catch {
      // Skip invalid skill files
    }
  }

  return skills;
}
