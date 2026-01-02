/**
 * @skillpkg/mcp-server
 *
 * MCP Server for skillpkg - Enable AI agents to search, install,
 * and manage skills via Model Context Protocol.
 *
 * @example
 * ```typescript
 * import { SkillpkgMcpServer, createAllToolHandlers } from 'skillpkg-mcp-server';
 *
 * const server = new SkillpkgMcpServer({ scope: 'local' });
 * server.registerTools(createAllToolHandlers());
 * await server.start();
 * ```
 */

export const VERSION = '0.1.0';

// Types
export * from './types.js';

// Server
export { SkillpkgMcpServer } from './server.js';

// Tool handlers
export {
  createAllToolHandlers,
  createListSkillsHandler,
  createLoadSkillHandler,
  createSearchSkillsHandler,
  createInstallSkillHandler,
  createUninstallSkillHandler,
  createSearchRegistryHandler,
  createSkillInfoHandler,
  createRecommendSkillHandler,
} from './tools/index.js';
