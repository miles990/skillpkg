/**
 * Source parser - Parse source strings into typed objects
 */
import { existsSync } from 'fs';
import type { ParsedSource } from './types.js';
import { InvalidSourceError } from './types.js';

/**
 * GitHub repo with optional subpath: user/repo or user/repo#path/to/skill
 * Captures: [1] = user/repo, [2] = subpath (optional)
 */
const GITHUB_REPO_WITH_SUBPATH = /^([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:#(.+))?$/;

/**
 * Parse a source string to determine its type and value
 *
 * @param source - Source string (github:user/repo, gist:id, URL, or path)
 * @returns Parsed source with type and normalized value
 * @throws InvalidSourceError if source format is not recognized
 *
 * @example
 * parseSource('github:user/repo')           // { type: 'github', value: 'user/repo', original: ... }
 * parseSource('github:user/repo#path/skill') // { type: 'github', value: 'user/repo', subpath: 'path/skill', ... }
 * parseSource('user/repo')                  // { type: 'github', value: 'user/repo', original: ... }
 * parseSource('user/repo#docs/skills/x')    // { type: 'github', value: 'user/repo', subpath: 'docs/skills/x', ... }
 * parseSource('gist:abc123')                // { type: 'gist', value: 'abc123', original: ... }
 * parseSource('https://...')                // { type: 'url', value: 'https://...', original: ... }
 * parseSource('./path')                     // { type: 'local', value: './path', original: ... }
 * parseSource('file.skillpkg')              // { type: 'pack', value: 'file.skillpkg', original: ... }
 */
export function parseSource(source: string): ParsedSource {
  const trimmed = source.trim();

  if (!trimmed) {
    throw new InvalidSourceError(source, 'Source cannot be empty');
  }

  // GitHub: github:user/repo or github:user/repo#path/to/skill
  if (trimmed.startsWith('github:')) {
    const rest = trimmed.slice(7);
    const match = GITHUB_REPO_WITH_SUBPATH.exec(rest);
    if (!match) {
      throw new InvalidSourceError(source, 'Invalid GitHub repo format. Use github:user/repo or github:user/repo#path');
    }
    const [, repo, subpath] = match;
    return {
      type: 'github',
      value: repo,
      subpath: subpath || undefined,
      original: source,
    };
  }

  // Gist: gist:id
  if (trimmed.startsWith('gist:')) {
    const value = trimmed.slice(5);
    if (!value) {
      throw new InvalidSourceError(source, 'Gist ID cannot be empty');
    }
    return { type: 'gist', value, original: source };
  }

  // URL: http:// or https://
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return { type: 'url', value: trimmed, original: source };
  }

  // Pack file: *.skillpkg
  if (trimmed.endsWith('.skillpkg')) {
    return { type: 'pack', value: trimmed, original: source };
  }

  // Local path: starts with ./ or ../ or / or exists on filesystem
  if (
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('/')
  ) {
    return { type: 'local', value: trimmed, original: source };
  }

  // GitHub shorthand: user/repo or user/repo#path (if matches pattern and doesn't exist locally)
  const shorthandMatch = GITHUB_REPO_WITH_SUBPATH.exec(trimmed);
  if (shorthandMatch && !existsSync(shorthandMatch[1])) {
    const [, repo, subpath] = shorthandMatch;
    return {
      type: 'github',
      value: repo,
      subpath: subpath || undefined,
      original: source,
    };
  }

  // If it exists as a local path, treat as local
  if (existsSync(trimmed)) {
    return { type: 'local', value: trimmed, original: source };
  }

  // Unknown format
  throw new InvalidSourceError(source);
}

/**
 * Normalize source to canonical format
 *
 * @example
 * normalizeSource('user/repo')      // 'github:user/repo'
 * normalizeSource('github:u/r')     // 'github:u/r'
 * normalizeSource('./path')         // './path'
 */
export function normalizeSource(source: string): string {
  const parsed = parseSource(source);

  switch (parsed.type) {
    case 'github':
      // Preserve subpath if present: github:user/repo#path
      if (parsed.subpath) {
        return `github:${parsed.value}#${parsed.subpath}`;
      }
      return `github:${parsed.value}`;
    case 'gist':
      return `gist:${parsed.value}`;
    default:
      return parsed.value;
  }
}

/**
 * Check if source is a remote source (requires network)
 */
export function isRemoteSource(source: string): boolean {
  try {
    const parsed = parseSource(source);
    return ['github', 'gist', 'url'].includes(parsed.type);
  } catch {
    return false;
  }
}

/**
 * Check if source is a local source (no network needed)
 */
export function isLocalSource(source: string): boolean {
  try {
    const parsed = parseSource(source);
    return ['local', 'pack'].includes(parsed.type);
  } catch {
    return false;
  }
}
