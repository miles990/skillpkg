/**
 * Fetcher module - Unified skill fetching from various sources
 *
 * Supports:
 * - GitHub: github:user/repo or user/repo
 * - Gist: gist:id
 * - URL: https://... or http://...
 * - Local: ./path, ../path, /absolute/path
 * - Pack: *.skillpkg files
 */

export * from './types.js';
export * from './source-parser.js';
export * from './fetcher.js';
