/**
 * Claude Code adapter
 *
 * Syncs skills to .claude/skills/{skill-name}/SKILL.md format
 */
import { join } from 'path';
import { readdir } from 'fs/promises';
import type { Skill } from '../types.js';
import { BaseAdapter } from './base.js';

/**
 * Claude Code skill file format (SKILL.md with YAML frontmatter)
 */
interface ClaudeCodeFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  'allowed-tools'?: string[];
}

/**
 * Claude Code platform adapter
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';

  /**
   * Detect if Claude Code is present (.claude/ directory exists)
   */
  async detect(projectPath: string): Promise<boolean> {
    return this.dirExists(join(projectPath, '.claude'));
  }

  /**
   * Get the output path for a skill
   * Format: .claude/skills/{skill-name}/SKILL.md
   */
  getOutputPath(skillName: string, projectPath: string): string {
    return join(projectPath, '.claude', 'skills', skillName, 'SKILL.md');
  }

  /**
   * Format skill content as SKILL.md with YAML frontmatter
   */
  protected formatSkillContent(skill: Skill): string {
    const frontmatter: ClaudeCodeFrontmatter = {
      name: skill.name,
      description: skill.description,
      version: skill.version,
    };

    // Add allowed-tools if specified in platform config
    const claudeConfig = skill.platforms?.['claude-code'];
    if (claudeConfig?.['allowed-tools']) {
      frontmatter['allowed-tools'] = claudeConfig['allowed-tools'];
    }

    // Build YAML frontmatter
    const yamlLines: string[] = ['---'];
    yamlLines.push(`name: ${frontmatter.name}`);
    yamlLines.push(`description: ${JSON.stringify(frontmatter.description)}`);
    yamlLines.push(`version: ${frontmatter.version}`);
    if (frontmatter['allowed-tools']?.length) {
      yamlLines.push('allowed-tools:');
      for (const tool of frontmatter['allowed-tools']) {
        yamlLines.push(`  - ${tool}`);
      }
    }
    yamlLines.push('---');
    yamlLines.push('');

    // Add skill instructions
    yamlLines.push(skill.instructions);

    return yamlLines.join('\n');
  }

  /**
   * Check if a path can be imported from Claude Code format
   */
  async canImport(path: string): Promise<boolean> {
    // Check if it's a SKILL.md file or .claude/skills directory
    if (path.endsWith('SKILL.md')) {
      const content = await this.readFileSafe(path);
      return content !== null && content.startsWith('---');
    }

    // Check if it's a .claude/skills directory
    if (path.endsWith('.claude/skills') || path.includes('.claude/skills/')) {
      return this.dirExists(path);
    }

    return false;
  }

  /**
   * Import a skill from Claude Code SKILL.md format
   */
  async import(path: string): Promise<Skill> {
    const content = await this.readFileSafe(path);
    if (!content) {
      throw new Error(`Cannot read file: ${path}`);
    }

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      throw new Error(`Invalid SKILL.md format: missing frontmatter`);
    }

    const [, frontmatterYaml, instructions] = frontmatterMatch;

    // Simple YAML parsing for frontmatter
    const frontmatter = this.parseSimpleYaml(frontmatterYaml);

    // Build skill object
    const skill: Skill = {
      schema: '1.0',
      name: (frontmatter.name as string) || 'imported-skill',
      version: (frontmatter.version as string) || '1.0.0',
      description: (frontmatter.description as string) || '',
      instructions: instructions.trim(),
    };

    // Add allowed-tools if present
    if (frontmatter['allowed-tools']) {
      skill.platforms = {
        'claude-code': {
          'allowed-tools': frontmatter['allowed-tools'] as string[],
        },
      };
    }

    return skill;
  }

  /**
   * List all skills in .claude/skills/
   */
  async listSkills(projectPath: string): Promise<string[]> {
    const skillsDir = join(projectPath, '.claude', 'skills');
    if (!this.dirExists(skillsDir)) {
      return [];
    }

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey = '';
    let currentArray: string[] = [];

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;

      // Check for array item
      if (line.startsWith('  - ')) {
        currentArray.push(line.slice(4).trim());
        continue;
      }

      // Save previous array if exists
      if (currentKey && currentArray.length > 0) {
        result[currentKey] = currentArray;
        currentArray = [];
      }

      // Parse key-value
      const match = line.match(/^(\S+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        currentKey = key;

        if (value) {
          // Handle quoted strings
          if (value.startsWith('"') && value.endsWith('"')) {
            result[key] = value.slice(1, -1);
          } else {
            result[key] = value;
          }
          currentKey = '';
        }
      }
    }

    // Save final array if exists
    if (currentKey && currentArray.length > 0) {
      result[currentKey] = currentArray;
    }

    return result;
  }
}
