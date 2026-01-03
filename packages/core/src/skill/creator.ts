/**
 * SkillCreator - Create new SKILL.md files
 */
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { SkillFrontmatter, CreateSkillOptions } from './types.js';

/**
 * SkillCreator - Creates new skills with SKILL.md format
 */
export class SkillCreator {
  /**
   * Create a new skill
   *
   * @param options - Creation options
   * @returns Path to created SKILL.md
   */
  async create(options: CreateSkillOptions): Promise<string> {
    const { name, description, instructions, createDir = true, targetDir = process.cwd() } = options;

    const normalizedName = this.normalizeName(name);
    const skillDir = createDir ? join(targetDir, normalizedName) : targetDir;
    const skillMdPath = join(skillDir, 'SKILL.md');

    // Check if already exists
    if (existsSync(skillMdPath)) {
      throw new Error(`SKILL.md already exists in ${skillDir}`);
    }

    // Create directory if needed
    if (createDir && !existsSync(skillDir)) {
      await mkdir(skillDir, { recursive: true });
    }

    // Generate template
    const template = this.generateTemplate(normalizedName, description, instructions);

    // Write file
    await writeFile(skillMdPath, template, 'utf-8');

    return skillMdPath;
  }

  /**
   * Generate SKILL.md template content
   *
   * @param name - Skill name (kebab-case)
   * @param description - Short description
   * @param instructions - Custom instructions content
   * @returns SKILL.md content with frontmatter
   */
  generateTemplate(name: string, description?: string, instructions?: string): string {
    const metadata: SkillFrontmatter = {
      name: this.normalizeName(name),
      version: '1.0.0',
      description: description || 'A helpful skill',
    };

    // Use custom instructions or default template
    const content = instructions || `# ${this.toTitleCase(name)}

Add your skill instructions here...

## Usage

Describe how to use this skill.

## Examples

Provide usage examples.
`;

    return matter.stringify(content, metadata);
  }

  /**
   * Normalize name to kebab-case
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Convert kebab-case to Title Case
   */
  private toTitleCase(name: string): string {
    return name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * Create a SkillCreator instance
 */
export function createSkillCreator(): SkillCreator {
  return new SkillCreator();
}
