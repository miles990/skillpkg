/**
 * Fetcher types
 */
import type { Skill } from '../types.js';

/**
 * Supported source types
 */
export type SourceType = 'github' | 'gist' | 'url' | 'local' | 'pack';

/**
 * Parsed source information
 */
export interface ParsedSource {
  type: SourceType;
  value: string;
  /** Subpath within repo (for github:user/repo#path format) */
  subpath?: string;
  /** Original source string */
  original: string;
}

/**
 * Additional file in a skill directory (scripts, resources, etc.)
 */
export interface SkillFile {
  /** Relative path within skill directory (e.g., "scripts/setup.sh") */
  path: string;
  /** File content (string for text, base64 for binary) */
  content: string;
  /** Whether content is base64-encoded binary */
  binary?: boolean;
}

/**
 * Fetch result
 */
export interface FetchResult {
  success: boolean;
  skill?: Skill;
  /** Additional files in the skill directory */
  files?: SkillFile[];
  error?: string;
  /** Source URL for tracking */
  sourceUrl?: string;
}

/**
 * Fetcher options
 */
export interface FetcherOptions {
  /** GitHub token for API requests */
  githubToken?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Error thrown when source format is invalid
 */
export class InvalidSourceError extends Error {
  constructor(source: string, hint?: string) {
    const message = hint
      ? `Invalid source "${source}": ${hint}`
      : `Invalid source "${source}". Supported formats: github:user/repo, user/repo, gist:id, https://url, ./local/path, or file.skillpkg`;
    super(message);
    this.name = 'InvalidSourceError';
  }
}
