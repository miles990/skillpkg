#!/usr/bin/env node
/**
 * CLI entry point for skillpkg MCP server
 *
 * Usage:
 *   npx skillpkg-mcp-server
 *   skillpkg serve (via CLI integration)
 */

import { SkillpkgMcpServer } from './server.js';
import { createAllToolHandlers } from './tools/index.js';

async function main(): Promise<void> {
  // Create server with default options
  const server = new SkillpkgMcpServer({
    scope: 'local',
    projectPath: process.cwd(),
  });

  // Register all tool handlers
  server.registerTools(createAllToolHandlers());

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('[skillpkg-mcp] Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('[skillpkg-mcp] Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('[skillpkg-mcp] Failed to start server:', error);
    process.exit(1);
  }
}

main();
