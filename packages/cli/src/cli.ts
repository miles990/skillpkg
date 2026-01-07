/**
 * CLI command registration
 */
import type { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { uninstallCommand } from './commands/uninstall.js';
import { importCommand } from './commands/import.js';
import { exportCommand } from './commands/export.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { configCommand } from './commands/config.js';
// Registry commands - hidden until public registry is available
// import { loginCommand, logoutCommand, whoamiCommand } from './commands/login.js';
// import { publishCommand } from './commands/publish.js';
import { depsCommand, whyCommand, treeCommand } from './commands/deps.js';
import { statusCommand } from './commands/status.js';
import { newCommand } from './commands/new.js';
import { doctorCommand } from './commands/doctor.js';
// import { migrateCommand } from './commands/migrate.js'; // Hidden until needed

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  // init - Initialize a skillpkg project with Claude Code configuration
  program
    .command('init')
    .description('Initialize Claude Code configuration (skillpkg.json + rules + memory)')
    .option('-y, --yes', 'Use default values without prompts')
    .option('-n, --name <name>', 'Project name')
    .option('-p, --preset <preset>', 'Use preset (minimal, standard, full, custom)')
    .option('-d, --domain <domain>', 'Add domain-specific rules (frontend, backend, fullstack, devops)')
    .option('-t, --template <template>', 'Use custom template from GitHub')
    .action(initCommand);

  // new - Create a new skill
  program
    .command('new [name]')
    .description('Create a new skill (SKILL.md)')
    .option('-i, --interactive', 'Interactive mode')
    .action(newCommand);

  // install - Install a skill
  program
    .command('install [skill]')
    .alias('i')
    .description('Install a skill from registry or local path')
    .option('-g, --global', 'Install globally')
    .option('--registry <url>', 'Use custom registry')
    .option('--dry-run', 'Show what would be installed without making changes')
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
    .option('--dry-run', 'Show what would be removed without making changes')
    .action(uninstallCommand);

  // config - Manage global configuration
  program
    .command('config [subcommand] [key] [value]')
    .description('Manage global skillpkg configuration')
    .option('--json', 'Output as JSON')
    .action(configCommand);

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

  // search - Multi-source skill discovery
  program
    .command('search <query>')
    .description('Search for skills across multiple sources')
    .option('-l, --limit <number>', 'Maximum results to return', '20')
    .option('-s, --source <source>', 'Source to search (local, skillsmp, awesome, github, all)')
    .option('--json', 'Output as JSON')
    .action(searchCommand);

  // info - Get detailed information about a skill
  program
    .command('info <skill>')
    .description('Get detailed information about a skill from the registry')
    .option('--json', 'Output as JSON')
    .option('--registry <url>', 'Use custom registry')
    .action(infoCommand);

  // Registry commands - hidden until public registry is available
  // login - Authenticate with a registry
  // program
  //   .command('login')
  //   .description('Authenticate with a registry')
  //   .option('--registry <url>', 'Registry URL')
  //   .option('-t, --token <token>', 'Auth token (for non-interactive use)')
  //   .action(loginCommand);

  // logout - Log out from a registry
  // program
  //   .command('logout')
  //   .description('Log out from a registry')
  //   .option('--registry <url>', 'Registry URL')
  //   .action(logoutCommand);

  // whoami - Show current logged in user
  // program
  //   .command('whoami')
  //   .description('Show current logged in user')
  //   .option('--registry <url>', 'Registry URL')
  //   .action(whoamiCommand);

  // publish - Publish a skill to the registry
  // program
  //   .command('publish')
  //   .description('Publish a skill to the registry')
  //   .option('--tag <tag>', 'Publish with tag (default: latest)')
  //   .option('--access <access>', 'Access level (public, restricted)')
  //   .option('--registry <url>', 'Registry URL')
  //   .option('--dry-run', 'Show what would be published without publishing')
  //   .action(publishCommand);

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

  // doctor - Diagnose and repair state
  program
    .command('doctor')
    .description('Diagnose and repair skillpkg state inconsistencies')
    .option('--fix', 'Automatically fix detected issues')
    .option('--dry-run', 'Show what would be fixed without making changes')
    .option('--json', 'Output as JSON')
    .action(doctorCommand);

  // migrate - Migrate from v1.x to v2.0
  // Hidden: Not registered in CLI until public release needs migration support
  // To enable: uncomment the command registration below
  // program
  //   .command('migrate')
  //   .description('Migrate from v1.x to v2.0 (generates skillpkg.json and state.json)')
  //   .option('--dry-run', 'Show what would be migrated without making changes')
  //   .option('-f, --force', 'Overwrite existing skillpkg.json and state.json')
  //   .action(migrateCommand);
}
