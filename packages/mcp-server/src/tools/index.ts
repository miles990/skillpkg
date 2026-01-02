/**
 * Tool Handlers Index
 *
 * Exports all tool handlers for the MCP server.
 * Each tool is designed to be AI-friendly with clear descriptions and structured outputs.
 */

import type { ToolHandler } from '../types.js';

// Import all tool handlers
import { createListSkillsHandler } from './list-skills.js';
import { createLoadSkillHandler } from './load-skill.js';
import { createSearchSkillsHandler } from './search-skills.js';
import { createInstallSkillHandler } from './install-skill.js';
import { createUninstallSkillHandler } from './uninstall-skill.js';
import { createSkillInfoHandler } from './skill-info.js';
import { createRecommendSkillHandler } from './recommend-skill.js';

/**
 * Create all tool handlers
 */
export function createAllToolHandlers(): ToolHandler[] {
  return [
    // Core skill management
    createListSkillsHandler(),
    createLoadSkillHandler(),
    createInstallSkillHandler(),
    createUninstallSkillHandler(),

    // Search & Discovery
    createSearchSkillsHandler(),
    createSkillInfoHandler(),
    createRecommendSkillHandler(),
  ];
}

// Export individual handlers for selective use
export {
  createListSkillsHandler,
  createLoadSkillHandler,
  createSearchSkillsHandler,
  createInstallSkillHandler,
  createUninstallSkillHandler,
  createSkillInfoHandler,
  createRecommendSkillHandler,
};

// Re-export utilities
export * from './utils.js';
