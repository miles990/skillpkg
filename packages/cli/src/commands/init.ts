/**
 * init command - Initialize a skillpkg project
 *
 * v2.1: Added preset and template support
 * - Presets: minimal, standard, full, custom
 * - Templates: Load from GitHub repos
 * - Non-invasive: Only add files, never modify existing
 */
import { basename, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import inquirer from 'inquirer';
import { createConfigManager, type SkillpkgConfig } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface InitOptions {
  yes?: boolean;
  name?: string;
  preset?: 'minimal' | 'standard' | 'full' | 'custom';
  template?: string;
  domain?: string;
}

// Preset configurations
const PRESETS = {
  minimal: {
    name: 'Minimal',
    description: 'Just CLAUDE.md + basic rules',
    components: ['claude-md', 'basic-rules'],
    skills: [],
    memory: false,
  },
  standard: {
    name: 'Standard (Recommended)',
    description: 'Memory system + self-evolving agent',
    components: ['claude-md', 'basic-rules', 'mcp-config', 'memory-system'],
    skills: ['miles990/self-evolving-agent'],
    memory: true,
  },
  full: {
    name: 'Full',
    description: 'Everything including software skills',
    components: ['claude-md', 'all-rules', 'mcp-config', 'memory-system'],
    skills: ['miles990/self-evolving-agent', 'miles990/claude-software-skills'],
    memory: true,
  },
};

// Domain-specific configurations (used in createDomainRules)
const DOMAIN_NAMES: Record<string, string> = {
  frontend: 'Frontend Development',
  backend: 'Backend Development',
  fullstack: 'Full-Stack Development',
  devops: 'DevOps & Infrastructure',
};

/**
 * Get default project name from directory
 */
function getDefaultProjectName(): string {
  const dirName = basename(process.cwd());
  return toKebabCase(dirName) || 'my-project';
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}


/**
 * Safely write file (skip if exists)
 */
function safeWriteFile(filePath: string, content: string): boolean {
  if (existsSync(filePath)) {
    logger.log(`  ${colors.yellow('○')} ${filePath} ${colors.dim('(already exists, skipped)')}`);
    return false;
  }

  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf-8');
  logger.log(`  ${colors.green('✓')} ${filePath}`);
  return true;
}

/**
 * Create CLAUDE.md content
 */
function createClaudeMd(projectName: string): string {
  return `# ${projectName}

> Project configured with skillpkg

## Quick Reference

- \`/evolve [goal]\` - Trigger self-evolving agent
- \`/memory\` - Edit memory files
- \`skillpkg list\` - Show installed skills

## Project Structure

See @.claude/rules/ for coding standards.
See @.github/memory/index.md for project knowledge.
`;
}

/**
 * Create basic rules
 */
function createBasicRules(): Record<string, string> {
  return {
    '.claude/rules/code-quality.md': `---
paths: src/**/*.{ts,tsx,js,jsx}
---

# Code Quality Standards

- Write clean, readable code with meaningful names
- Follow DRY principle
- Keep functions small and focused
- Handle errors explicitly
`,
    '.claude/rules/testing.md': `---
paths: **/*.test.{ts,tsx,js,jsx}, **/*.spec.{ts,tsx,js,jsx}
---

# Testing Standards

- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Minimum 80% coverage for new code
`,
  };
}

/**
 * Create all rules (includes memory and workflow)
 */
function createAllRules(): Record<string, string> {
  return {
    ...createBasicRules(),
    '.claude/rules/memory-management.md': `# Memory Management

## When to Create Memories

- **Learnings**: Solved a non-trivial problem
- **Failures**: Bug took >30min to solve
- **Decisions**: Architectural choices (ADR)
- **Patterns**: Reusable reasoning approaches

## Memory Workflow

1. Search before starting: \`Grep pattern="keyword" path=".github/memory/"\`
2. Create memory after learning
3. Update index.md
`,
    '.claude/rules/evolve-workflow.md': `# Self-Evolving Workflow

## Mandatory Checkpoints

1. Before task: Search memory for related experience
2. After changes: Run build + tests
3. After milestone: Verify goal alignment

## Failure Handling

1. Diagnose failure type (A-E)
2. Record if novel
3. Try alternative strategy
4. Escalate after 3 attempts
`,
  };
}

/**
 * Create MCP configuration
 */
function createMcpConfig(): Record<string, string> {
  return {
    '.mcp.json': JSON.stringify(
      {
        mcpServers: {
          skillpkg: {
            command: 'npx',
            args: ['-y', 'skillpkg-mcp-server'],
          },
          context7: {
            command: 'npx',
            args: ['-y', '@anthropic-ai/claude-code-mcp-context7'],
          },
        },
      },
      null,
      2
    ),
    '.claude/settings.json': JSON.stringify(
      {
        permissions: {
          allow: ['Bash(npm:*)', 'Bash(git:*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        },
      },
      null,
      2
    ),
  };
}

/**
 * Create memory system structure
 */
function createMemorySystem(): Record<string, string> {
  return {
    '.github/memory/index.md': `# Project Memory Index

> Search with: \`Grep pattern="keyword" path=".github/memory/"\`

## Learnings
<!-- LEARNINGS_START -->
<!-- LEARNINGS_END -->

## Decisions
<!-- DECISIONS_START -->
<!-- DECISIONS_END -->

## Failures
<!-- FAILURES_START -->
<!-- FAILURES_END -->

## Patterns
<!-- PATTERNS_START -->
<!-- PATTERNS_END -->
`,
    '.github/memory/learnings/.gitkeep': '',
    '.github/memory/decisions/.gitkeep': '',
    '.github/memory/failures/.gitkeep': '',
    '.github/memory/patterns/.gitkeep': '',
    '.github/memory/strategies/.gitkeep': '',
  };
}

/**
 * Create domain-specific rules
 */
function createDomainRules(domain: string): Record<string, string> {
  const rules: Record<string, string> = {};

  if (domain === 'frontend' || domain === 'fullstack') {
    rules['.claude/rules/frontend.md'] = `---
paths: src/components/**/*.{tsx,jsx}
---

# Frontend Rules

- Use functional components with hooks
- Keep components small (<200 lines)
- Use CSS modules or styled-components
`;
  }

  if (domain === 'backend' || domain === 'fullstack') {
    rules['.claude/rules/backend.md'] = `---
paths: src/api/**/*.ts, src/services/**/*.ts
---

# Backend Rules

- Use dependency injection
- Validate all inputs
- Return consistent error format
`;
  }

  if (domain === 'devops') {
    rules['.claude/rules/devops.md'] = `# DevOps Rules

- Use multi-stage Docker builds
- Never commit secrets
- Use environment variables for config
`;
  }

  return rules;
}

/**
 * Update .gitignore
 */
function updateGitignore(cwd: string): void {
  const gitignorePath = join(cwd, '.gitignore');
  const additions = `
# Claude Code
.claude/CLAUDE.local.md
.claude/skills/*
!.claude/skills/.gitkeep
.skillpkg/
`;

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('# Claude Code')) {
      writeFileSync(gitignorePath, content + additions, 'utf-8');
      logger.log(`  ${colors.green('✓')} Updated .gitignore`);
    } else {
      logger.log(`  ${colors.yellow('○')} .gitignore ${colors.dim('(Claude section exists)')}`);
    }
  } else {
    writeFileSync(gitignorePath, additions.trim() + '\n', 'utf-8');
    logger.log(`  ${colors.green('✓')} .gitignore`);
  }
}

/**
 * init command handler
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const configManager = createConfigManager();
  const projectName = options.name || getDefaultProjectName();

  logger.header('Claude Code Configuration Wizard');
  logger.log(colors.dim('Non-invasive: Only adds new files, never modifies existing'));
  logger.blank();

  let preset = options.preset;
  let domain = options.domain;
  let components: string[] = [];
  let skills: string[] = [];
  let hasMemory = false;

  // Determine configuration
  if (options.yes) {
    // Quick mode - use standard preset
    const presetKey = (preset && preset !== 'custom' ? preset : 'standard') as keyof typeof PRESETS;
    const presetConfig = PRESETS[presetKey];
    components = presetConfig.components;
    skills = [...presetConfig.skills];
    hasMemory = presetConfig.memory;
    logger.info(`Using preset: ${colors.cyan(presetConfig.name)}`);
  } else if (preset && preset !== 'custom') {
    // Preset specified
    const presetKey = preset as keyof typeof PRESETS;
    const presetConfig = PRESETS[presetKey];
    components = presetConfig.components;
    skills = [...presetConfig.skills];
    hasMemory = presetConfig.memory;
  } else {
    // Interactive mode
    const presetAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'preset',
        message: 'Choose a preset:',
        choices: [
          { name: `${PRESETS.minimal.name} - ${PRESETS.minimal.description}`, value: 'minimal' },
          { name: `${PRESETS.standard.name} - ${PRESETS.standard.description}`, value: 'standard' },
          { name: `${PRESETS.full.name} - ${PRESETS.full.description}`, value: 'full' },
          { name: 'Custom - Choose exactly what you need', value: 'custom' },
        ],
        default: 'standard',
      },
    ]);

    if (presetAnswer.preset === 'custom') {
      // Custom selection
      const customAnswer = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'components',
          message: 'Select components to install:',
          choices: [
            { name: 'CLAUDE.md (project entry point)', value: 'claude-md', checked: true },
            { name: 'Basic Rules (code quality, testing)', value: 'basic-rules', checked: true },
            { name: 'MCP Configuration (skillpkg, context7)', value: 'mcp-config', checked: true },
            { name: 'Memory System (.github/memory/)', value: 'memory-system', checked: true },
          ],
        },
        {
          type: 'checkbox',
          name: 'skills',
          message: 'Select skills to install:',
          choices: [
            { name: 'Self-Evolving Agent (autonomous goal achievement)', value: 'miles990/self-evolving-agent', checked: true },
            { name: 'Software Skills (47 development modules)', value: 'miles990/claude-software-skills', checked: false },
          ],
        },
      ]);

      components = customAnswer.components;
      skills = customAnswer.skills;
      hasMemory = components.includes('memory-system');
    } else {
      const presetConfig = PRESETS[presetAnswer.preset as keyof typeof PRESETS];
      components = presetConfig.components;
      skills = [...presetConfig.skills];
      hasMemory = presetConfig.memory;
    }

    // Ask about domain (if not minimal)
    if (presetAnswer.preset !== 'minimal' && !domain) {
      const domainAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'domain',
          message: 'Add domain-specific rules?',
          choices: [
            { name: 'None - General purpose', value: '' },
            { name: `${DOMAIN_NAMES.frontend} - React, Vue, CSS`, value: 'frontend' },
            { name: `${DOMAIN_NAMES.backend} - Node.js, API, Database`, value: 'backend' },
            { name: `${DOMAIN_NAMES.fullstack} - Frontend + Backend`, value: 'fullstack' },
            { name: `${DOMAIN_NAMES.devops} - CI/CD, Docker`, value: 'devops' },
          ],
        },
      ]);
      domain = domainAnswer.domain;
    }
  }

  logger.blank();
  logger.log(colors.cyan('Installing configuration...'));
  logger.blank();

  // Create .claude directory
  const claudeDir = join(cwd, '.claude');
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  // Install components
  if (components.includes('claude-md')) {
    safeWriteFile(join(cwd, 'CLAUDE.md'), createClaudeMd(projectName));
  }

  if (components.includes('basic-rules')) {
    const rules = createBasicRules();
    for (const [path, content] of Object.entries(rules)) {
      safeWriteFile(join(cwd, path), content);
    }
  }

  if (components.includes('all-rules')) {
    const rules = createAllRules();
    for (const [path, content] of Object.entries(rules)) {
      safeWriteFile(join(cwd, path), content);
    }
  }

  if (components.includes('mcp-config')) {
    const configs = createMcpConfig();
    for (const [path, content] of Object.entries(configs)) {
      safeWriteFile(join(cwd, path), content);
    }
  }

  if (components.includes('memory-system') || hasMemory) {
    const memoryFiles = createMemorySystem();
    for (const [path, content] of Object.entries(memoryFiles)) {
      safeWriteFile(join(cwd, path), content);
    }
  }

  // Install domain rules
  if (domain) {
    const domainRules = createDomainRules(domain);
    for (const [path, content] of Object.entries(domainRules)) {
      safeWriteFile(join(cwd, path), content);
    }
  }

  // Create skillpkg.json
  const existingConfig = await configManager.loadProjectConfig(cwd);
  if (!existingConfig) {
    const config: SkillpkgConfig = {
      $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
      name: projectName,
      skills: {},
      sync_targets: {
        'claude-code': true,
      },
    };

    // Add skills to config
    for (const skill of skills) {
      const skillName = skill.split('/').pop() || skill;
      config.skills![skillName] = `github:${skill}`;
    }

    await withSpinner('Creating skillpkg.json', async () => {
      await configManager.initProject(cwd, config.name);
      const loaded = await configManager.loadProjectConfig(cwd);
      if (loaded) {
        loaded.skills = config.skills;
        loaded.sync_targets = config.sync_targets;
        await configManager.saveProjectConfig(cwd, loaded);
      }
    });
    logger.log(`  ${colors.green('✓')} skillpkg.json`);
  } else {
    logger.log(`  ${colors.yellow('○')} skillpkg.json ${colors.dim('(already exists)')}`);
  }

  // Update .gitignore
  updateGitignore(cwd);

  // Create .claude/skills/.gitkeep
  const skillsDir = join(cwd, '.claude/skills');
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }
  safeWriteFile(join(skillsDir, '.gitkeep'), '');

  logger.blank();
  logger.success('Setup complete!');
  logger.blank();

  // Show next steps
  logger.log('Next steps:');
  logger.blank();

  if (skills.length > 0) {
    logger.item(`Install skills:    ${colors.cyan('skillpkg install')}`);
  }
  logger.item(`Sync to Claude:    ${colors.cyan('skillpkg sync')}`);
  logger.item(`Start Claude Code: ${colors.cyan('claude')}`);

  if (skills.includes('miles990/self-evolving-agent')) {
    logger.item(`Try evolving:      ${colors.cyan('/evolve [your goal]')}`);
  }

  logger.blank();
}
