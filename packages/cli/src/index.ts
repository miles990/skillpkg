#!/usr/bin/env node
/**
 * @skillpkg/cli - Agent Skills Package Manager CLI
 */
import { program } from 'commander';
import { registerCommands } from './cli.js';

// Get version from package.json
const VERSION = '0.0.1';

program
  .name('skillpkg')
  .description('Agent Skills Package Manager - Install once, use everywhere')
  .version(VERSION, '-v, --version', 'Output the current version');

// Register all commands
registerCommands(program);

// Parse arguments
program.parse();
