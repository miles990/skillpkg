/**
 * deps command - Show skill dependencies
 *
 * v2.0: Uses StateManager and DependencyResolver from core
 */
import {
  createStateManager,
  type SkillState,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface DepsOptions {
  json?: boolean;
}

/**
 * deps command handler - Show dependencies of a skill
 */
export async function depsCommand(
  skillName: string,
  options: DepsOptions
): Promise<void> {
  const cwd = process.cwd();
  const stateManager = createStateManager();

  // Load state
  const state = await stateManager.loadState(cwd);

  // Check if skill exists
  const skillState = state.skills[skillName];
  if (!skillState) {
    logger.error(`Skill not found: ${colors.cyan(skillName)}`);
    logger.log(`Run ${colors.cyan('skillpkg list')} to see installed skills`);
    process.exit(1);
  }

  if (options.json) {
    // JSON output
    const output = {
      skill: skillName,
      version: skillState.version,
      dependsOn: skillState.depended_by || [],
      requiredBy: Object.entries(state.skills)
        .filter(([_, s]) => s.depended_by?.includes(skillName))
        .map(([name]) => name),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  logger.header(`Dependencies for ${colors.cyan(skillName)}`);
  logger.blank();

  logger.log(`Version: ${colors.dim(skillState.version)}`);
  logger.log(`Source: ${colors.dim(skillState.source)}`);
  logger.log(`Installed by: ${colors.dim(skillState.installed_by)}`);
  logger.blank();

  // Show what this skill depends on
  const dependsOn = skillState.depended_by || [];
  if (dependsOn.length > 0) {
    logger.log('Depends on:');
    for (const dep of dependsOn) {
      const depState = state.skills[dep];
      if (depState) {
        logger.item(`${colors.cyan(dep)} ${colors.dim(`v${depState.version}`)}`);
      } else {
        logger.item(`${colors.cyan(dep)} ${colors.red('(not installed)')}`);
      }
    }
  } else {
    logger.log(colors.dim('No dependencies'));
  }

  logger.blank();

  // Show what depends on this skill
  const requiredBy = Object.entries(state.skills)
    .filter(([_, s]) => s.depended_by?.includes(skillName))
    .map(([name]) => name);

  if (requiredBy.length > 0) {
    logger.log('Required by:');
    for (const dep of requiredBy) {
      const depState = state.skills[dep];
      logger.item(`${colors.cyan(dep)} ${colors.dim(`v${depState.version}`)}`);
    }
  } else {
    logger.log(colors.dim('No skills depend on this'));
  }

  logger.blank();
}

/**
 * why command handler - Show why a skill is installed
 */
export async function whyCommand(
  skillName: string,
  options: DepsOptions
): Promise<void> {
  const cwd = process.cwd();
  const stateManager = createStateManager();

  // Load state
  const state = await stateManager.loadState(cwd);

  // Check if skill exists
  const skillState = state.skills[skillName];
  if (!skillState) {
    logger.error(`Skill not found: ${colors.cyan(skillName)}`);
    logger.log(`Run ${colors.cyan('skillpkg list')} to see installed skills`);
    process.exit(1);
  }

  if (options.json) {
    // JSON output
    const output = buildDependencyChain(skillName, state.skills);
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  logger.header(`Why is ${colors.cyan(skillName)} installed?`);
  logger.blank();

  if (skillState.installed_by === 'user') {
    logger.success('Directly installed by user');
    logger.log(`Source: ${colors.dim(skillState.source)}`);
  } else {
    logger.log('Installed as a dependency');
    logger.blank();

    // Build dependency chain
    const chain = buildDependencyChain(skillName, state.skills);
    printDependencyChain(chain, 0);
  }

  logger.blank();
}

/**
 * tree command handler - Show full dependency tree
 */
export async function treeCommand(options: DepsOptions): Promise<void> {
  const cwd = process.cwd();
  const stateManager = createStateManager();

  // Load state
  const state = await stateManager.loadState(cwd);

  const skills = Object.keys(state.skills);
  if (skills.length === 0) {
    logger.error('No skills installed');
    logger.log(`Run ${colors.cyan('skillpkg install <skill>')} to install skills`);
    process.exit(1);
  }

  if (options.json) {
    // JSON output - full tree structure
    const tree = buildFullTree(state.skills);
    console.log(JSON.stringify(tree, null, 2));
    return;
  }

  // Human-readable output
  logger.header('Dependency Tree');
  logger.blank();

  // Get root skills (user-installed)
  const rootSkills = Object.entries(state.skills)
    .filter(([_, s]) => s.installed_by === 'user')
    .map(([name]) => name);

  if (rootSkills.length === 0) {
    logger.log(colors.dim('No user-installed skills'));
    logger.blank();
    return;
  }

  for (const rootName of rootSkills) {
    printSkillTree(rootName, state.skills, 0, new Set());
  }

  logger.blank();

  // Summary
  const userInstalled = rootSkills.length;
  const transitive = skills.length - userInstalled;
  logger.log(
    `Total: ${colors.cyan(String(skills.length))} skills ` +
      `(${userInstalled} direct, ${transitive} transitive)`
  );
  logger.blank();
}

/**
 * Build dependency chain for "why" command
 */
interface DependencyChain {
  skill: string;
  version: string;
  installedBy: string;
  requiredBy?: DependencyChain[];
}

function buildDependencyChain(
  skillName: string,
  skills: Record<string, SkillState>
): DependencyChain {
  const skillState = skills[skillName];
  if (!skillState) {
    return { skill: skillName, version: 'unknown', installedBy: 'unknown' };
  }

  const chain: DependencyChain = {
    skill: skillName,
    version: skillState.version,
    installedBy: skillState.installed_by,
  };

  // Find skills that depend on this one
  const requiredBy = Object.entries(skills)
    .filter(([_, s]) => s.depended_by?.includes(skillName))
    .map(([name]) => buildDependencyChain(name, skills));

  if (requiredBy.length > 0) {
    chain.requiredBy = requiredBy;
  }

  return chain;
}

/**
 * Print dependency chain (for "why" command)
 */
function printDependencyChain(chain: DependencyChain, depth: number): void {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '' : '└── ';

  if (chain.installedBy === 'user') {
    logger.log(
      `${indent}${prefix}${colors.cyan(chain.skill)} ${colors.dim(`v${chain.version}`)} ${colors.green('(user)')}`
    );
  } else {
    logger.log(
      `${indent}${prefix}${colors.cyan(chain.skill)} ${colors.dim(`v${chain.version}`)}`
    );
  }

  if (chain.requiredBy) {
    for (const dep of chain.requiredBy) {
      printDependencyChain(dep, depth + 1);
    }
  }
}

/**
 * Build full tree structure for JSON output
 */
interface TreeNode {
  name: string;
  version: string;
  dependencies?: TreeNode[];
}

function buildFullTree(skills: Record<string, SkillState>): TreeNode[] {
  const roots = Object.entries(skills)
    .filter(([_, s]) => s.installed_by === 'user')
    .map(([name]) => buildTreeNode(name, skills, new Set()));

  return roots;
}

function buildTreeNode(
  skillName: string,
  skills: Record<string, SkillState>,
  visited: Set<string>
): TreeNode {
  const skillState = skills[skillName];
  const node: TreeNode = {
    name: skillName,
    version: skillState?.version || 'unknown',
  };

  if (visited.has(skillName)) {
    return { ...node, name: `${skillName} (circular)` };
  }

  visited.add(skillName);

  const deps = skillState?.depended_by || [];
  if (deps.length > 0) {
    node.dependencies = deps.map((dep) => buildTreeNode(dep, skills, new Set(visited)));
  }

  return node;
}

/**
 * Print skill tree (for "tree" command)
 */
function printSkillTree(
  skillName: string,
  skills: Record<string, SkillState>,
  depth: number,
  visited: Set<string>
): void {
  const skillState = skills[skillName];
  const indent = depth === 0 ? '' : '  '.repeat(depth - 1) + '├── ';

  if (visited.has(skillName)) {
    logger.log(`${indent}${colors.cyan(skillName)} ${colors.yellow('(circular)')}`);
    return;
  }

  visited.add(skillName);

  const version = skillState?.version || 'unknown';
  logger.log(`${indent}${colors.cyan(skillName)} ${colors.dim(`v${version}`)}`);

  const deps = skillState?.depended_by || [];
  for (let i = 0; i < deps.length; i++) {
    printSkillTree(deps[i], skills, depth + 1, new Set(visited));
  }
}
