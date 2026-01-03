/**
 * Base adapter abstract class
 */
import { existsSync } from 'fs';
import { mkdir, writeFile, readFile, rm, stat } from 'fs/promises';
import { dirname } from 'path';
import type { Skill } from '../types.js';
import type { PlatformAdapter } from './types.js';

/**
 * Abstract base class for platform adapters
 */
export abstract class BaseAdapter implements PlatformAdapter {
  abstract name: string;
  abstract displayName: string;

  /**
   * Detect if this platform is present in the project
   * Default implementation checks for platform-specific directory
   */
  abstract detect(projectPath: string): Promise<boolean>;

  /**
   * Get the output path for a skill
   */
  abstract getOutputPath(skillName: string, projectPath: string): string;

  /**
   * Check if a path can be imported from this platform
   */
  abstract canImport(path: string): Promise<boolean>;

  /**
   * Import a skill from this platform format
   */
  abstract import(path: string): Promise<Skill>;

  /**
   * Format skill content for this platform
   * Override in subclasses for platform-specific formatting
   */
  protected abstract formatSkillContent(skill: Skill): string;

  /**
   * Sync a skill to this platform
   */
  async sync(skill: Skill, projectPath: string): Promise<void> {
    const outputPath = this.getOutputPath(skill.name, projectPath);
    const content = this.formatSkillContent(skill);

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Write file
    await writeFile(outputPath, content, 'utf-8');
  }

  /**
   * Remove a skill from this platform
   */
  async remove(skillName: string, projectPath: string): Promise<void> {
    const outputPath = this.getOutputPath(skillName, projectPath);
    // Get the skill directory (parent of SKILL.md)
    const skillDir = dirname(outputPath);

    if (!existsSync(skillDir)) return;

    try {
      const stats = await stat(skillDir);
      if (stats.isDirectory()) {
        // Remove entire skill directory (including SKILL.md and any additional files)
        await rm(skillDir, { recursive: true });
      }
    } catch {
      // Ignore errors during removal
    }
  }

  /**
   * Helper: Read file content safely
   */
  protected async readFileSafe(path: string): Promise<string | null> {
    try {
      if (!existsSync(path)) return null;
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Helper: Check if directory exists
   */
  protected dirExists(path: string): boolean {
    return existsSync(path);
  }
}
