/**
 * CLI command registration
 */
import type { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { uninstallCommand } from './commands/uninstall.js';
import { syncCommand } from './commands/sync.js';
import { importCommand } from './commands/import.js';
import { exportCommand } from './commands/export.js';

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

  // import - Import skills from platform formats
  program
    .command('import [path]')
    .description('Import skills from platform formats (Claude Code, Codex, etc.)')
    .option('-f, --from <path>', 'Source path to import from')
    .option('-g, --global', 'Import to global store')
    .option('--dry-run', 'Show what would be imported without making changes')
    .option('--overwrite', 'Overwrite existing skills')
    .action(importCommand);

  // export - Export skills to various formats
  program
    .command('export [skill]')
    .description('Export skills to various formats (dir, zip, tarball, pack)')
    .option('-f, --format <format>', 'Export format (dir, zip, tarball, pack)', 'dir')
    .option('-o, --output <path>', 'Output directory')
    .option('-g, --global', 'Export from global store')
    .option('-a, --all', 'Export all skills')
    .option('--overwrite', 'Overwrite existing files')
    .action(exportCommand);
}
