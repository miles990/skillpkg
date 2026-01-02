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
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/login.js';
import { publishCommand } from './commands/publish.js';
import { depsCommand, whyCommand, treeCommand } from './commands/deps.js';
import { statusCommand } from './commands/status.js';
import { migrateCommand } from './commands/migrate.js';

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  // init - Initialize a skillpkg project
  program
    .command('init')
    .description('Initialize a skillpkg project (create skillpkg.json)')
    .option('-y, --yes', 'Use default values without prompts')
    .option('-n, --name <name>', 'Project name')
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
    .option('-f, --force', 'Force uninstall even if other skills depend on it')
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

  // search - Search for skills in the registry
  program
    .command('search <query>')
    .description('Search for skills in the registry')
    .option('-l, --limit <number>', 'Number of results per page', '20')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-s, --sort <field>', 'Sort by (relevance, downloads, updated, name)')
    .option('--json', 'Output as JSON')
    .option('--registry <url>', 'Use custom registry')
    .action(searchCommand);

  // info - Get detailed information about a skill
  program
    .command('info <skill>')
    .description('Get detailed information about a skill from the registry')
    .option('--json', 'Output as JSON')
    .option('--registry <url>', 'Use custom registry')
    .action(infoCommand);

  // login - Authenticate with a registry
  program
    .command('login')
    .description('Authenticate with a registry')
    .option('--registry <url>', 'Registry URL')
    .option('-t, --token <token>', 'Auth token (for non-interactive use)')
    .action(loginCommand);

  // logout - Log out from a registry
  program
    .command('logout')
    .description('Log out from a registry')
    .option('--registry <url>', 'Registry URL')
    .action(logoutCommand);

  // whoami - Show current logged in user
  program
    .command('whoami')
    .description('Show current logged in user')
    .option('--registry <url>', 'Registry URL')
    .action(whoamiCommand);

  // publish - Publish a skill to the registry
  program
    .command('publish')
    .description('Publish a skill to the registry')
    .option('--tag <tag>', 'Publish with tag (default: latest)')
    .option('--access <access>', 'Access level (public, restricted)')
    .option('--registry <url>', 'Registry URL')
    .option('--dry-run', 'Show what would be published without publishing')
    .action(publishCommand);

  // deps - Show dependencies of a skill
  program
    .command('deps <skill>')
    .description('Show dependencies of a skill')
    .option('--json', 'Output as JSON')
    .action(depsCommand);

  // why - Show why a skill is installed
  program
    .command('why <skill>')
    .description('Show why a skill is installed (dependency chain)')
    .option('--json', 'Output as JSON')
    .action(whyCommand);

  // tree - Show full dependency tree
  program
    .command('tree')
    .description('Show full dependency tree of installed skills')
    .option('--json', 'Output as JSON')
    .action(treeCommand);

  // status - Show project status
  program
    .command('status')
    .description('Show overall project status (skills, MCP, sync)')
    .option('--json', 'Output as JSON')
    .action(statusCommand);

  // migrate - Migrate from v1.x to v2.0
  program
    .command('migrate')
    .description('Migrate from v1.x to v2.0 (generates skillpkg.json and state.json)')
    .option('--dry-run', 'Show what would be migrated without making changes')
    .option('-f, --force', 'Overwrite existing skillpkg.json and state.json')
    .action(migrateCommand);
}
