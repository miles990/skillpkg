/**
 * @skillpkg/core
 *
 * Core library for skillpkg - Agent Skills Package Manager
 */

export const VERSION = '0.5.5';

// Types
export * from './types.js';

// Parser module
export * from './parser/index.js';

// Store module
export * from './store/index.js';

// Adapters module
export * from './adapters/index.js';

// Importer module
export * from './importer/index.js';

// Exporter module
export * from './exporter/index.js';

// Registry module (deprecated - use GitHub module instead)
export * from './registry/index.js';

// GitHub module - Search skills on GitHub
export * from './github/index.js';

// Config module - Project configuration (skillpkg.json)
export * from './config/index.js';

// State module - Installation state tracking (.skillpkg/state.json)
export * from './state/index.js';

// Resolver module - Dependency resolution
export * from './resolver/index.js';

// Syncer module - Sync to AI tools
export * from './syncer/index.js';

// Installer module - Dependency-aware installation
export * from './installer/index.js';

// Skill module - Read and create SKILL.md files
export * from './skill/index.js';

// Fetcher module - Unified skill fetching from various sources
export * from './fetcher/index.js';

// Discovery module - Multi-source skill discovery
export * from './discovery/index.js';
