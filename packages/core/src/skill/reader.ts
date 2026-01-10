/**
 * SkillReader - Read SKILL.md files
 *
 * Only supports SKILL.md format (Markdown with YAML frontmatter).
 * skill.yaml format is no longer supported.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { SkillFrontmatter, ParsedSkill } from './types.js';

/**
 * Validation error for skill metadata
 */
export class SkillValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
    this.name = 'SkillValidationError';
  }
}

/**
 * Validate skill metadata
 * Compatible with Claude Code / superpowers minimal format (name + description only)
 */
function validateMetadata(data: Record<string, unknown>): SkillFrontmatter {
  // Required fields (only name and description are truly required)
  if (!data.name || typeof data.name !== 'string') {
    throw new SkillValidationError('Missing required field: name', 'name');
  }

  if (!data.description || typeof data.description !== 'string') {
    throw new SkillValidationError('Missing required field: description', 'description');
  }

  // Validate name format (kebab-case) - be lenient, just warn if invalid
  const namePattern = /^[a-z][a-z0-9-]*[a-z0-9]$/;
  if (data.name.length >= 2 && !namePattern.test(data.name)) {
    // Allow but don't enforce strict kebab-case for compatibility
    console.warn(`Warning: name "${data.name}" is not in kebab-case format`);
  }

  // Validate version format if provided (semver-like)
  const version = typeof data.version === 'string' ? data.version : '1.0.0';
  if (data.version && !/^\d+\.\d+\.\d+/.test(version)) {
    console.warn(`Warning: version "${data.version}" is not in semver format, using default`);
  }

  return {
    name: data.name,
    version: /^\d+\.\d+\.\d+/.test(version) ? version : '1.0.0',
    description: data.description,
    author: data.author as string | undefined,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    dependencies: data.dependencies as SkillFrontmatter['dependencies'],
  };
}

/**
 * Read a SKILL.md file from a directory
 *
 * @param dirPath - Directory containing SKILL.md
 * @returns Parsed skill content
 * @throws Error if SKILL.md is not found or invalid
 */
export async function readSkill(dirPath: string): Promise<ParsedSkill> {
  const skillMdPath = join(dirPath, 'SKILL.md');

  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found in ${dirPath}`);
  }

  const rawContent = await readFile(skillMdPath, 'utf-8');
  const { data, content } = matter(rawContent);

  // Validate metadata
  const metadata = validateMetadata(data);

  return {
    metadata,
    content: content.trim(),
    rawContent,
    filePath: skillMdPath,
  };
}

/**
 * Read a SKILL.md file directly
 *
 * @param filePath - Path to SKILL.md file
 * @returns Parsed skill content
 */
export async function readSkillFile(filePath: string): Promise<ParsedSkill> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const rawContent = await readFile(filePath, 'utf-8');
  const { data, content } = matter(rawContent);

  // Validate metadata
  const metadata = validateMetadata(data);

  return {
    metadata,
    content: content.trim(),
    rawContent,
    filePath,
  };
}

/**
 * Check if a directory contains a valid SKILL.md
 */
export function hasSkillMd(dirPath: string): boolean {
  return existsSync(join(dirPath, 'SKILL.md'));
}
