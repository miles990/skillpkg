/**
 * VS Code Cline adapter
 *
 * Syncs skills to .cline/rules/{skill-name}.md format
 */
import { join } from 'path';
import { readdir } from 'fs/promises';
import type { Skill } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Cline platform adapter
 */
export class ClineAdapter extends BaseAdapter {
  name = 'cline';
  displayName = 'VS Code Cline';

  /**
   * Detect if Cline is present (.cline/ directory exists)
   */
  async detect(projectPath: string): Promise<boolean> {
    return this.dirExists(join(projectPath, '.cline'));
  }

  /**
   * Get the output path for a skill
   * Format: .cline/rules/{skill-name}.md
   */
  getOutputPath(skillName: string, projectPath: string): string {
    return join(projectPath, '.cline', 'rules', `${skillName}.md`);
  }

  /**
   * Format skill content for Cline format
   */
  protected formatSkillContent(skill: Skill): string {
    const lines: string[] = [];

    // Cline uses simple markdown format
    lines.push(`# ${skill.name}`);
    lines.push('');
    lines.push(`> ${skill.description}`);
    lines.push('');
    lines.push(`**Version:** ${skill.version}`);
    lines.push('');

    // Triggers as "When to use"
    if (skill.triggers?.length) {
      lines.push('## When to use');
      lines.push('');
      for (const trigger of skill.triggers) {
        lines.push(`- ${trigger}`);
      }
      lines.push('');
    }

    // Capabilities as "Required capabilities"
    if (skill.capabilities?.length) {
      lines.push('## Required capabilities');
      lines.push('');
      for (const cap of skill.capabilities) {
        lines.push(`- \`${cap}\``);
      }
      lines.push('');
    }

    // Instructions
    lines.push('## Instructions');
    lines.push('');
    lines.push(skill.instructions);

    return lines.join('\n');
  }

  /**
   * Check if a path can be imported from Cline format
   */
  async canImport(path: string): Promise<boolean> {
    // Check for .cline/rules/*.md files
    if (path.includes('.cline/rules/') && path.endsWith('.md')) {
      const content = await this.readFileSafe(path);
      return content !== null && content.startsWith('# ');
    }

    // Check for .cline/rules directory
    if (path.endsWith('.cline/rules')) {
      return this.dirExists(path);
    }

    return false;
  }

  /**
   * Import a skill from Cline format
   */
  async import(path: string): Promise<Skill> {
    const content = await this.readFileSafe(path);
    if (!content) {
      throw new Error(`Cannot read file: ${path}`);
    }

    // Parse markdown format
    const nameMatch = content.match(/^# (.+)$/m);
    const descMatch = content.match(/^> (.+)$/m);
    const versionMatch = content.match(/\*\*Version:\*\*\s*(.+)$/m);

    // Extract instructions (everything after "## Instructions")
    const instructionsMatch = content.match(/## Instructions\n\n([\s\S]*?)(?=\n## |$)/);

    const skill: Skill = {
      schema: '1.0',
      name: nameMatch?.[1] || this.extractNameFromPath(path),
      version: versionMatch?.[1] || '1.0.0',
      description: descMatch?.[1] || '',
      instructions: instructionsMatch?.[1]?.trim() || this.extractInstructions(content),
    };

    // Extract triggers
    const triggersSection = content.match(/## When to use\n\n([\s\S]*?)(?=\n## |$)/);
    if (triggersSection) {
      const triggers = triggersSection[1].match(/^- (.+)$/gm);
      if (triggers) {
        skill.triggers = triggers.map((t) => t.slice(2));
      }
    }

    // Extract capabilities
    const capsSection = content.match(/## Required capabilities\n\n([\s\S]*?)(?=\n## |$)/);
    if (capsSection) {
      const caps = capsSection[1].match(/`(.+?)`/g);
      if (caps) {
        skill.capabilities = caps.map((c) => c.slice(1, -1)) as Skill['capabilities'];
      }
    }

    return skill;
  }

  /**
   * List all skills in .cline/rules/
   */
  async listSkills(projectPath: string): Promise<string[]> {
    const rulesDir = join(projectPath, '.cline', 'rules');
    if (!this.dirExists(rulesDir)) {
      return [];
    }

    try {
      const entries = await readdir(rulesDir);
      return entries
        .filter((entry) => entry.endsWith('.md'))
        .map((entry) => entry.replace('.md', ''));
    } catch {
      return [];
    }
  }

  /**
   * Extract skill name from file path
   */
  private extractNameFromPath(path: string): string {
    const match = path.match(/([^/\\]+)\.md$/);
    return match?.[1] || 'imported-skill';
  }

  /**
   * Extract instructions when no "## Instructions" section found
   */
  private extractInstructions(content: string): string {
    // Remove header and metadata, keep the rest as instructions
    return content
      .replace(/^# .+$/m, '')
      .replace(/^> .+$/m, '')
      .replace(/\*\*Version:\*\*.+$/m, '')
      .replace(/## When to use[\s\S]*?(?=\n## |$)/, '')
      .replace(/## Required capabilities[\s\S]*?(?=\n## |$)/, '')
      .trim();
  }
}
