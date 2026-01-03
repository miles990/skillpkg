/**
 * Skill module - Read and create SKILL.md files
 *
 * @example
 * ```typescript
 * import { readSkill, SkillCreator } from '@skillpkg/core';
 *
 * // Read a skill
 * const skill = await readSkill('./my-skill');
 * console.log(skill.metadata.name);
 *
 * // Create a new skill
 * const creator = new SkillCreator();
 * await creator.create({ name: 'my-skill', description: 'A helpful skill' });
 * ```
 */

// Types
export type {
  SkillFrontmatter,
  ParsedSkill,
  McpDependency,
  CreateSkillOptions,
} from './types.js';

// Reader
export { readSkill, readSkillFile, hasSkillMd, SkillValidationError } from './reader.js';

// Creator
export { SkillCreator, createSkillCreator } from './creator.js';
