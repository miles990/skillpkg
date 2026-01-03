#!/usr/bin/env node
/**
 * @skillpkg/cli - Agent Skills Package Manager CLI
 */
import { program } from 'commander';
import { createRequire } from 'module';
import { registerCommands } from './cli.js';

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
