/**
 * GitHub Copilot adapter
 *
 * Syncs skills to .github/copilot-instructions.md (append mode)
 */
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Skill } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Marker for skillpkg-managed sections
 */
const SKILL_START_MARKER = '<!-- skillpkg:';
const SKILL_END_MARKER = '<!-- /skillpkg:';

/**
 * GitHub Copilot platform adapter
 */
export class CopilotAdapter extends BaseAdapter {
  name = 'copilot';
  displayName = 'GitHub Copilot';

  /**
   * Detect if GitHub Copilot is present (.github/ directory exists)
   */
  async detect(projectPath: string): Promise<boolean> {
    return this.dirExists(join(projectPath, '.github'));
  }

  /**
   * Get the output path for a skill
   * Note: All skills go into the same file
   */
  getOutputPath(_skillName: string, projectPath: string): string {
    return join(projectPath, '.github', 'copilot-instructions.md');
  }

  /**
   * Format skill content as a marked section
   */
  protected formatSkillContent(skill: Skill): string {
    const lines: string[] = [];

    lines.push(`${SKILL_START_MARKER}${skill.name} -->`);
    lines.push('');
    lines.push(`## ${skill.name}`);
    lines.push('');
    lines.push(`> ${skill.description}`);
    lines.push('');

    // Mode config if specified
    const copilotConfig = skill.platforms?.copilot;
    if (copilotConfig?.mode) {
      lines.push(`_Mode: ${copilotConfig.mode}_`);
      lines.push('');
    }

    lines.push(skill.instructions);
    lines.push('');
    lines.push(`${SKILL_END_MARKER}${skill.name} -->`);

    return lines.join('\n');
  }

  /**
   * Sync a skill to copilot-instructions.md (append/replace mode)
   */
  async sync(skill: Skill, projectPath: string): Promise<void> {
    const outputPath = this.getOutputPath(skill.name, projectPath);
    const skillContent = this.formatSkillContent(skill);

    // Read existing content
    let existingContent = '';
    if (existsSync(outputPath)) {
      existingContent = await readFile(outputPath, 'utf-8');
    }

    // Check if skill already exists in file
    const startMarker = `${SKILL_START_MARKER}${skill.name} -->`;
    const endMarker = `${SKILL_END_MARKER}${skill.name} -->`;
    const startIndex = existingContent.indexOf(startMarker);
    const endIndex = existingContent.indexOf(endMarker);

    let newContent: string;

    if (startIndex !== -1 && endIndex !== -1) {
      // Replace existing section
      newContent =
        existingContent.slice(0, startIndex) +
        skillContent +
        existingContent.slice(endIndex + endMarker.length);
    } else {
      // Append new section
      newContent = existingContent.trim()
        ? `${existingContent.trim()}\n\n${skillContent}`
        : skillContent;
    }

    // Write file
    await writeFile(outputPath, newContent, 'utf-8');
  }

  /**
   * Remove a skill from copilot-instructions.md
   */
  async remove(skillName: string, projectPath: string): Promise<void> {
    const outputPath = this.getOutputPath(skillName, projectPath);

    if (!existsSync(outputPath)) return;

    const content = await readFile(outputPath, 'utf-8');
    const startMarker = `${SKILL_START_MARKER}${skillName} -->`;
    const endMarker = `${SKILL_END_MARKER}${skillName} -->`;

    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) return;

    // Remove section (including surrounding whitespace)
    let newContent =
      content.slice(0, startIndex).trimEnd() +
      '\n\n' +
      content.slice(endIndex + endMarker.length).trimStart();

    // Clean up extra newlines
    newContent = newContent.replace(/\n{3,}/g, '\n\n').trim();

    await writeFile(outputPath, newContent || '', 'utf-8');
  }

  /**
   * Check if a path can be imported from Copilot format
   */
  async canImport(path: string): Promise<boolean> {
    if (!path.endsWith('copilot-instructions.md')) {
      return false;
    }
    return existsSync(path);
  }

  /**
   * Import skills from copilot-instructions.md
   * Note: Returns the first skill found (multi-skill import not supported here)
   */
  async import(path: string): Promise<Skill> {
    const content = await this.readFileSafe(path);
    if (!content) {
      throw new Error(`Cannot read file: ${path}`);
    }

    // Check for skillpkg markers
    const markerMatch = content.match(
      new RegExp(`${SKILL_START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\S+) -->`)
    );

    if (markerMatch) {
      // Parse marked section
      const skillName = markerMatch[1];
      const startMarker = `${SKILL_START_MARKER}${skillName} -->`;
      const endMarker = `${SKILL_END_MARKER}${skillName} -->`;
      const startIndex = content.indexOf(startMarker);
      const endIndex = content.indexOf(endMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        const section = content.slice(startIndex + startMarker.length, endIndex).trim();
        return this.parseSection(skillName, section);
      }
    }

    // No markers - treat entire file as single skill
    const nameMatch = content.match(/^## (.+)$/m);
    const descMatch = content.match(/^> (.+)$/m);

    return {
      schema: '1.0',
      name: nameMatch?.[1] || 'imported-skill',
      version: '1.0.0',
      description: descMatch?.[1] || '',
      instructions: content,
    };
  }

  /**
   * Parse a marked section into a skill
   */
  private parseSection(skillName: string, section: string): Skill {
    const descMatch = section.match(/^> (.+)$/m);
    const modeMatch = section.match(/_Mode: (edit|chat)_/);

    // Remove header and description to get instructions
    let instructions = section
      .replace(/^## .+$/m, '')
      .replace(/^> .+$/m, '')
      .replace(/_Mode: .+_/, '')
      .trim();

    const skill: Skill = {
      schema: '1.0',
      name: skillName,
      version: '1.0.0',
      description: descMatch?.[1] || '',
      instructions,
    };

    if (modeMatch) {
      skill.platforms = {
        copilot: {
          mode: modeMatch[1] as 'edit' | 'chat',
        },
      };
    }

    return skill;
  }
}
