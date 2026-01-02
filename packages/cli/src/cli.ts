/**
 * CLI command registration
 */
import type { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { uninstallCommand } from './commands/uninstall.js';
import { syncCommand } from './commands/sync.js';

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  // init - Create a new skill.yaml
  program
    .command('init')
    .description('Create a new skill.yaml file')
    .option('-y, --yes', 'Use default values without prompts')
    .option('-n, --name <name>', 'Skill name')
    .action(initCommand);

  // install - Install a skill
  program
    .command('install [skill]')
    .alias('i')
    .description('Install a skill from registry or local path')
    .option('-g, --global', 'Install globally')
    .option('--registry <url>', 'Use custom registry')
    .action(installCommand);

  // list - List installed skills
  program
    .command('list')
    .alias('ls')
    .description('List installed skills')
    .option('-g, --global', 'List globally installed skills')
    .option('--json', 'Output as JSON')
    .action(listCommand);

  // uninstall - Remove a skill
  program
    .command('uninstall <skill>')
    .alias('rm')
    .description('Uninstall a skill')
    .option('-g, --global', 'Uninstall from global store')
    .option('-c, --clean', 'Also remove synced files from all platforms')
    .action(uninstallCommand);

  // sync - Sync skills to platforms
  program
    .command('sync [skill]')
    .description('Sync skills to AI platforms')
    .option('-t, --target <platforms>', 'Target platforms (comma-separated)')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(syncCommand);
}
