/**
 * status command - Show overall project status
 *
 * v2.0: Shows skills, MCP, and sync status
 */
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createStateManager,
  createConfigManager,
  getImplementedTargets,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface StatusOptions {
  json?: boolean;
}

interface StatusOutput {
  project: {
    name: string | null;
    configExists: boolean;
    stateExists: boolean;
  };
  skills: {
    total: number;
    userInstalled: number;
    transitive: number;
    list: Array<{
      name: string;
      version: string;
      installedBy: string;
      source: string;
    }>;
  };
  mcp: {
    configured: number;
    list: Array<{
      name: string;
      command: string;
    }>;
  };
  sync: {
    targetsEnabled: string[];
    lastSync: Record<string, string | null>;
  };
}

/**
 * status command handler
 */
export async function statusCommand(options: StatusOptions): Promise<void> {
  const cwd = process.cwd();
  const stateManager = createStateManager();
  const configManager = createConfigManager();

  // Load state and config
  const state = await stateManager.loadState(cwd);
  const config = await configManager.loadProjectConfig(cwd);

  // Build status output
  const output: StatusOutput = {
    project: {
      name: config?.name || null,
      configExists: config !== null,
      stateExists: Object.keys(state.skills).length > 0,
    },
    skills: {
      total: 0,
      userInstalled: 0,
      transitive: 0,
      list: [],
    },
    mcp: {
      configured: 0,
      list: [],
    },
    sync: {
      targetsEnabled: [],
      lastSync: {},
    },
  };

  // Skills info
  for (const [name, skillState] of Object.entries(state.skills)) {
    output.skills.total++;
    if (skillState.installed_by === 'user') {
      output.skills.userInstalled++;
    } else {
      output.skills.transitive++;
    }
    output.skills.list.push({
      name,
      version: skillState.version,
      installedBy: skillState.installed_by,
      source: skillState.source,
    });
  }

  // MCP info
  if (config?.mcp) {
    for (const [name, mcpConfig] of Object.entries(config.mcp)) {
      output.mcp.configured++;
      output.mcp.list.push({
        name,
        command: mcpConfig.command || mcpConfig.package,
      });
    }
  }

  // Sync info
  if (config?.sync_targets) {
    output.sync.targetsEnabled = Object.entries(config.sync_targets)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);
  }

  // Get sync history from state
  if (state.sync_history) {
    for (const [target, timestamp] of Object.entries(state.sync_history)) {
      output.sync.lastSync[target] = timestamp
        ? new Date(timestamp).toLocaleString()
        : null;
    }
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  logger.header('skillpkg Status');
  logger.blank();

  // Project section
  logger.log(colors.bold('Project'));
  if (config) {
    logger.item(`Name: ${colors.cyan(config.name)}`);
    logger.item(`Config: ${colors.green('skillpkg.json found')}`);
  } else {
    logger.item(`Config: ${colors.yellow('No skillpkg.json')}`);
    logger.log(`  Run ${colors.cyan('skillpkg init')} to create one`);
  }
  logger.blank();

  // Skills section
  logger.log(colors.bold('Skills'));
  if (output.skills.total === 0) {
    logger.item(colors.dim('No skills installed'));
    logger.log(`  Run ${colors.cyan('skillpkg install <skill>')} to install`);
  } else {
    logger.item(
      `Total: ${colors.cyan(String(output.skills.total))} ` +
        `(${output.skills.userInstalled} direct, ${output.skills.transitive} transitive)`
    );

    // List skills grouped by install type
    const userSkills = output.skills.list.filter((s) => s.installedBy === 'user');
    const transitiveSkills = output.skills.list.filter((s) => s.installedBy !== 'user');

    if (userSkills.length > 0) {
      logger.log('  Direct:');
      for (const skill of userSkills) {
        logger.log(`    ${colors.cyan(skill.name)} ${colors.dim(`v${skill.version}`)}`);
      }
    }

    if (transitiveSkills.length > 0) {
      logger.log('  Transitive:');
      for (const skill of transitiveSkills) {
        logger.log(
          `    ${colors.dim(skill.name)} ${colors.dim(`v${skill.version}`)} ` +
            colors.dim(`(via ${skill.installedBy})`)
        );
      }
    }
  }
  logger.blank();

  // MCP section
  logger.log(colors.bold('MCP Servers'));
  if (output.mcp.configured === 0) {
    logger.item(colors.dim('No MCP servers configured'));
  } else {
    logger.item(`Configured: ${colors.cyan(String(output.mcp.configured))}`);
    for (const mcp of output.mcp.list) {
      logger.log(`    ${colors.cyan(mcp.name)}: ${colors.dim(mcp.command)}`);
    }
  }
  logger.blank();

  // Sync section
  logger.log(colors.bold('Sync Targets'));
  const implementedTargets = getImplementedTargets();
  const implementedIds = implementedTargets.map((t) => t.id);

  if (output.sync.targetsEnabled.length === 0) {
    logger.item(colors.dim('No sync targets enabled'));
  } else {
    for (const target of output.sync.targetsEnabled) {
      const isImplemented = implementedIds.includes(target as any);
      const lastSync = output.sync.lastSync[target];
      const status = isImplemented
        ? lastSync
          ? colors.green(`synced ${lastSync}`)
          : colors.yellow('not synced')
        : colors.dim('(not implemented)');

      logger.item(`${colors.cyan(target)}: ${status}`);

      // Check if target directory exists
      const targetConfig = implementedTargets.find((t) => t.id === target);
      if (targetConfig) {
        const targetPath = join(cwd, targetConfig.outputPath);
        const exists = existsSync(targetPath);
        if (!exists) {
          logger.log(`    ${colors.dim('Directory not created yet')}`);
        }
      }
    }
  }
  logger.blank();

  // Quick actions
  logger.log(colors.bold('Quick Actions'));
  if (output.skills.total === 0) {
    logger.item(`${colors.cyan('skillpkg search <query>')} - Find skills`);
    logger.item(`${colors.cyan('skillpkg install <skill>')} - Install a skill`);
  } else {
    logger.item(`${colors.cyan('skillpkg sync')} - Sync skills to platforms`);
    logger.item(`${colors.cyan('skillpkg tree')} - View dependency tree`);
  }
  logger.blank();
}
