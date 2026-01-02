/**
 * Codex (OpenAI) adapter
 *
 * Syncs skills to AGENTS.md or .codex/ format
 */
import { join } from 'path';
import type { Skill } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Codex platform adapter
 */
export class CodexAdapter extends BaseAdapter {
  name = 'codex';
  displayName = 'OpenAI Codex';

  /**
   * Detect if Codex is present (AGENTS.md or .codex/ exists)
   */
  async detect(projectPath: string): Promise<boolean> {
    return (
      this.dirExists(join(projectPath, '.codex')) ||
      this.dirExists(join(projectPath, 'AGENTS.md'))
    );
  }

  /**
   * Get the output path for a skill
   * Format: .codex/agents/{skill-name}.md
   */
  getOutputPath(skillName: string, projectPath: string): string {
    return join(projectPath, '.codex', 'agents', `${skillName}.md`);
  }

  /**
   * Format skill content for Codex format
   */
  protected formatSkillContent(skill: Skill): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${skill.name}`);
    lines.push('');
    lines.push(`> ${skill.description}`);
    lines.push('');

    // Version info
    lines.push(`**Version:** ${skill.version}`);
    lines.push('');

    // Sandbox config if specified
    const codexConfig = skill.platforms?.codex;
    if (codexConfig?.sandbox !== undefined) {
      lines.push(`**Sandbox:** ${codexConfig.sandbox ? 'enabled' : 'disabled'}`);
      lines.push('');
    }

    // Triggers
    if (skill.triggers?.length) {
      lines.push('## Triggers');
      lines.push('');
      for (const trigger of skill.triggers) {
        lines.push(`- \`${trigger}\``);
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
   * Check if a path can be imported from Codex format
   */
  async canImport(path: string): Promise<boolean> {
    // Check for AGENTS.md or .codex/ directory
    if (path.endsWith('AGENTS.md')) {
      const content = await this.readFileSafe(path);
      return content !== null && content.includes('# ');
    }

    if (path.includes('.codex/agents/') && path.endsWith('.md')) {
      return this.dirExists(path);
    }

    return false;
  }

  /**
   * Import a skill from Codex format
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
    const sandboxMatch = content.match(/\*\*Sandbox:\*\*\s*(enabled|disabled)/m);

    // Extract instructions (everything after "## Instructions")
    const instructionsMatch = content.match(/## Instructions\n\n([\s\S]*?)(?=\n## |$)/);

    const skill: Skill = {
      schema: '1.0',
      name: nameMatch?.[1] || 'imported-skill',
      version: versionMatch?.[1] || '1.0.0',
      description: descMatch?.[1] || '',
      instructions: instructionsMatch?.[1]?.trim() || content,
    };

    // Add sandbox config if present
    if (sandboxMatch) {
      skill.platforms = {
        codex: {
          sandbox: sandboxMatch[1] === 'enabled',
        },
      };
    }

    // Extract triggers if present
    const triggersSection = content.match(/## Triggers\n\n([\s\S]*?)(?=\n## |$)/);
    if (triggersSection) {
      const triggers = triggersSection[1].match(/- `(.+)`/g);
      if (triggers) {
        skill.triggers = triggers.map((t) => t.match(/`(.+)`/)![1]);
      }
    }

    return skill;
  }
}
