#!/usr/bin/env node
/**
 * @skillpkg/cli - Agent Skills Package Manager CLI
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { program } from 'commander';
import { createRequire } from 'module';
import { registerCommands } from './cli.js';

// Load .env files (project → global fallback)
const projectEnv = join(process.cwd(), '.env');
const globalEnv = join(homedir(), '.skillpkg', '.env');

if (existsSync(projectEnv)) {
  config({ path: projectEnv });
} else if (existsSync(globalEnv)) {
  config({ path: globalEnv });
}

// Get version from package.json
const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

program
  .name('skillpkg')
  .description('Agent Skills Package Manager - Install once, use everywhere')
  .version(VERSION, '-v, --version', 'Output the current version');

// Register all commands
registerCommands(program);

// Parse arguments
program.parse();
