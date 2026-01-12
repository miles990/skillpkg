/**
 * Syncer tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import {
  Syncer,
  createSyncer,
  loadSkillContent,
  loadSkillsFromDirectory,
  TARGET_CONFIGS,
  getTargetConfig,
  getImplementedTargets,
  getAllTargets,
  type SkillContent,
  type SyncerOptions,
} from '../index.js';
import type { SkillpkgConfig } from '../../config/types.js';

// Test directory
const TEST_DIR = join(process.cwd(), '.test-syncer');
const SKILLS_DIR = join(TEST_DIR, 'skills');
const OUTPUT_DIR = join(TEST_DIR, 'output');

// Helper to create test skill content
function createTestSkill(name: string, version = '1.0.0'): SkillContent {
  const rawContent = `---
name: ${name}
version: ${version}
description: Test skill ${name}
---

# ${name}

This is the instruction content for ${name}.
`;

  return {
    name,
    version,
    rawContent,
    bodyContent: `# ${name}\n\nThis is the instruction content for ${name}.\n`,
    frontmatter: { name, version, description: `Test skill ${name}` },
  };
}

// Helper to setup test environment
async function setupTestDir(): Promise<void> {
  await mkdir(TEST_DIR, { recursive: true });
  await mkdir(SKILLS_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

// Helper to cleanup test environment
async function cleanupTestDir(): Promise<void> {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
}

describe('TARGET_CONFIGS', () => {
  it('should have configuration for all Agent Skills adopters', () => {
    expect(TARGET_CONFIGS).toHaveProperty('claude-code');
    expect(TARGET_CONFIGS).toHaveProperty('cursor');
    expect(TARGET_CONFIGS).toHaveProperty('codex');
    expect(TARGET_CONFIGS).toHaveProperty('copilot');
  });

  it('should have all targets as implemented', () => {
    expect(TARGET_CONFIGS['claude-code'].implemented).toBe(true);
    expect(TARGET_CONFIGS.cursor.implemented).toBe(true);
    expect(TARGET_CONFIGS.codex.implemented).toBe(true);
    expect(TARGET_CONFIGS.copilot.implemented).toBe(true);
  });

  it('should use SKILL.md for all targets (Agent Skills standard)', () => {
    expect(TARGET_CONFIGS['claude-code'].skillFileName).toBe('SKILL.md');
    expect(TARGET_CONFIGS.cursor.skillFileName).toBe('SKILL.md');
    expect(TARGET_CONFIGS.codex.skillFileName).toBe('SKILL.md');
    expect(TARGET_CONFIGS.copilot.skillFileName).toBe('SKILL.md');
  });

  it('should have correct output paths', () => {
    expect(TARGET_CONFIGS['claude-code'].outputPath).toBe('.claude/skills');
    expect(TARGET_CONFIGS.cursor.outputPath).toBe('.cursor/skills');
    expect(TARGET_CONFIGS.codex.outputPath).toBe('.codex/skills');
    expect(TARGET_CONFIGS.copilot.outputPath).toBe('.github/skills');
  });
});

describe('getTargetConfig', () => {
  it('should return config for valid target', () => {
    const config = getTargetConfig('claude-code');
    expect(config.id).toBe('claude-code');
    expect(config.displayName).toBe('Claude Code');
  });
});

describe('getImplementedTargets', () => {
  it('should return all implemented targets', () => {
    const implemented = getImplementedTargets();
    // All 4 Agent Skills adopters are implemented
    expect(implemented.length).toBe(4);
    const ids = implemented.map((t) => t.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('cursor');
    expect(ids).toContain('codex');
    expect(ids).toContain('copilot');
  });
});

describe('getAllTargets', () => {
  it('should return all targets', () => {
    const all = getAllTargets();
    expect(all.length).toBe(4);
  });
});

describe('Syncer', () => {
  beforeEach(async () => {
    await setupTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('syncToTarget', () => {
    it('should sync skills to directory format target', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('test-skill', createTestSkill('test-skill'));

      const targetConfig = getTargetConfig('claude-code');
      const result = await syncer.syncToTarget(
        TEST_DIR,
        skills,
        targetConfig
      );

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);

      // Check file was created
      const skillFile = join(TEST_DIR, '.claude/skills/test-skill/SKILL.md');
      expect(existsSync(skillFile)).toBe(true);
    });

    it('should sync to cursor target successfully', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('test-skill', createTestSkill('test-skill'));

      const config: SkillpkgConfig = {
        name: 'test-project',
        sync_targets: { cursor: true },
      };

      const result = await syncer.syncAll(TEST_DIR, skills, config);

      // Should have one target result with success
      const cursorResult = result.targets.find((t) => t.target === 'cursor');
      expect(cursorResult?.success).toBe(true);

      // Check file was created with correct path (Agent Skills standard)
      const skillFile = join(TEST_DIR, '.cursor/skills/test-skill/SKILL.md');
      expect(existsSync(skillFile)).toBe(true);
    });

    it('should detect unchanged files', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('test-skill', createTestSkill('test-skill'));

      const targetConfig = getTargetConfig('claude-code');

      // First sync
      await syncer.syncToTarget(TEST_DIR, skills, targetConfig);

      // Second sync (should be unchanged)
      const result = await syncer.syncToTarget(TEST_DIR, skills, targetConfig);

      expect(result.success).toBe(true);
      expect(result.files[0].action).toBe('unchanged');
    });

    it('should detect updated files', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('test-skill', createTestSkill('test-skill', '1.0.0'));

      const targetConfig = getTargetConfig('claude-code');

      // First sync
      await syncer.syncToTarget(TEST_DIR, skills, targetConfig);

      // Update skill
      skills.set('test-skill', createTestSkill('test-skill', '2.0.0'));

      // Second sync (should be updated)
      const result = await syncer.syncToTarget(TEST_DIR, skills, targetConfig);

      expect(result.success).toBe(true);
      expect(result.files[0].action).toBe('updated');
    });
  });

  describe('syncAll', () => {
    it('should sync to all enabled targets', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('my-skill', createTestSkill('my-skill'));

      const config: SkillpkgConfig = {
        name: 'test-project',
        sync_targets: { 'claude-code': true },
      };

      const result = await syncer.syncAll(TEST_DIR, skills, config);

      expect(result.success).toBe(true);
      expect(result.stats.skillsSynced).toBe(1);
      expect(result.stats.filesCreated).toBeGreaterThan(0);
    });

    it('should use claude-code as default target', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('my-skill', createTestSkill('my-skill'));

      const config: SkillpkgConfig = {
        name: 'test-project',
        // No sync_targets specified
      };

      const result = await syncer.syncAll(TEST_DIR, skills, config);

      expect(result.success).toBe(true);
      expect(result.targets.some((t) => t.target === 'claude-code')).toBe(true);
    });
  });

  describe('syncMcpConfig', () => {
    it('should create .mcp.json file', async () => {
      const syncer = createSyncer();

      const mcpConfigs = {
        cipher: {
          package: '@anthropic/mcp-cipher',
          command: 'npx',
          args: ['@anthropic/mcp-cipher'],
        },
      };

      const result = await syncer.syncMcpConfig(TEST_DIR, mcpConfigs);

      expect(result.action).toBe('created');
      expect(existsSync(join(TEST_DIR, '.mcp.json'))).toBe(true);

      // Verify content
      const content = JSON.parse(await readFile(join(TEST_DIR, '.mcp.json'), 'utf-8'));
      expect(content.mcpServers).toHaveProperty('cipher');
    });

    it('should detect unchanged .mcp.json', async () => {
      const syncer = createSyncer();

      const mcpConfigs = {
        cipher: {
          package: '@anthropic/mcp-cipher',
        },
      };

      // First sync
      await syncer.syncMcpConfig(TEST_DIR, mcpConfigs);

      // Second sync
      const result = await syncer.syncMcpConfig(TEST_DIR, mcpConfigs);

      expect(result.action).toBe('unchanged');
    });
  });

  describe('transformForTarget', () => {
    it('should keep frontmatter for claude-code', () => {
      const syncer = createSyncer();
      const skill = createTestSkill('test');
      const targetConfig = getTargetConfig('claude-code');

      const result = syncer.transformForTarget(skill, targetConfig);

      expect(result).toContain('---');
      expect(result).toContain('name: test');
    });

    it('should keep frontmatter for codex (Agent Skills standard)', () => {
      const syncer = createSyncer();
      const skill = createTestSkill('test');
      const targetConfig = getTargetConfig('codex');

      const result = syncer.transformForTarget(skill, targetConfig);

      // All Agent Skills adopters use the same SKILL.md format with frontmatter
      expect(result).toContain('---');
      expect(result).toContain('name: test');
      expect(result).toContain('This is the instruction content');
    });
  });

  describe('dry run mode', () => {
    it('should not write files in dry run mode', async () => {
      const syncer = createSyncer();
      const skills = new Map<string, SkillContent>();
      skills.set('test-skill', createTestSkill('test-skill'));

      const targetConfig = getTargetConfig('claude-code');
      const options: SyncerOptions = { dryRun: true };

      const result = await syncer.syncToTarget(TEST_DIR, skills, targetConfig, options);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);

      // File should NOT be created
      const skillFile = join(TEST_DIR, '.claude/skills/test-skill/SKILL.md');
      expect(existsSync(skillFile)).toBe(false);
    });
  });

  describe('essentialOnly mode', () => {
    it('should only sync SKILL.md without additional files', async () => {
      const syncer = createSyncer();

      // Create skill with additional files (simulating a skill directory with scripts)
      const skillSourceDir = join(SKILLS_DIR, 'skill-with-scripts');
      await mkdir(skillSourceDir, { recursive: true });
      await writeFile(
        join(skillSourceDir, 'SKILL.md'),
        `---\nname: skill-with-scripts\nversion: 1.0.0\n---\n\n# Skill with Scripts\n\nMain instructions.`
      );
      await writeFile(join(skillSourceDir, 'helper.sh'), '#!/bin/bash\necho "helper"');
      await writeFile(join(skillSourceDir, 'utils.py'), 'print("utils")');

      // Load skills from directory (this sets sourcePath)
      const skills = await loadSkillsFromDirectory(SKILLS_DIR);
      expect(skills.has('skill-with-scripts')).toBe(true);

      const targetConfig = getTargetConfig('claude-code');

      // Sync with essentialOnly: true
      const result = await syncer.syncToTarget(TEST_DIR, skills, targetConfig, {
        essentialOnly: true,
      });

      expect(result.success).toBe(true);

      // SKILL.md should exist
      const skillFile = join(TEST_DIR, '.claude/skills/skill-with-scripts/SKILL.md');
      expect(existsSync(skillFile)).toBe(true);

      // Additional files should NOT exist
      const helperFile = join(TEST_DIR, '.claude/skills/skill-with-scripts/helper.sh');
      const utilsFile = join(TEST_DIR, '.claude/skills/skill-with-scripts/utils.py');
      expect(existsSync(helperFile)).toBe(false);
      expect(existsSync(utilsFile)).toBe(false);
    });

    it('should copy all files without essentialOnly option', async () => {
      const syncer = createSyncer();

      // Create skill with additional files
      const skillSourceDir = join(SKILLS_DIR, 'full-skill');
      await mkdir(skillSourceDir, { recursive: true });
      await writeFile(
        join(skillSourceDir, 'SKILL.md'),
        `---\nname: full-skill\nversion: 1.0.0\n---\n\n# Full Skill\n\nMain instructions.`
      );
      await writeFile(join(skillSourceDir, 'script.sh'), '#!/bin/bash\necho "script"');

      // Load skills from directory
      const skills = await loadSkillsFromDirectory(SKILLS_DIR);
      expect(skills.has('full-skill')).toBe(true);

      const targetConfig = getTargetConfig('claude-code');

      // Sync without essentialOnly (default behavior)
      const result = await syncer.syncToTarget(TEST_DIR, skills, targetConfig, {
        essentialOnly: false,
      });

      expect(result.success).toBe(true);

      // Both SKILL.md and additional files should exist
      const skillFile = join(TEST_DIR, '.claude/skills/full-skill/SKILL.md');
      const scriptFile = join(TEST_DIR, '.claude/skills/full-skill/script.sh');
      expect(existsSync(skillFile)).toBe(true);
      expect(existsSync(scriptFile)).toBe(true);
    });
  });
});

describe('loadSkillContent', () => {
  beforeEach(async () => {
    await setupTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  it('should load skill from SKILL.md with frontmatter', async () => {
    const skillPath = join(TEST_DIR, 'SKILL.md');
    const content = `---
name: my-skill
version: 2.0.0
description: My awesome skill
---

# My Skill

Instructions here.
`;
    await writeFile(skillPath, content);

    const skill = await loadSkillContent(skillPath);

    expect(skill.name).toBe('my-skill');
    expect(skill.version).toBe('2.0.0');
    expect(skill.bodyContent).toContain('# My Skill');
    expect(skill.bodyContent).not.toContain('---');
  });

  it('should return defaults for non-SKILL.md files (skill.yaml no longer supported)', async () => {
    // Note: skill.yaml format is deprecated - only SKILL.md is supported
    const skillPath = join(TEST_DIR, 'skill.yaml');
    const content = `name: yaml-skill
version: 1.5.0
instructions: |
  These are the instructions.
`;
    await writeFile(skillPath, content);

    const skill = await loadSkillContent(skillPath);

    // Pure YAML without Markdown frontmatter returns defaults
    expect(skill.name).toBe('unknown');
    expect(skill.version).toBe('1.0.0');
  });

  it('should handle markdown without frontmatter', async () => {
    const skillPath = join(TEST_DIR, 'SKILL.md');
    const content = `# No Frontmatter Skill

Just plain markdown.
`;
    await writeFile(skillPath, content);

    const skill = await loadSkillContent(skillPath);

    expect(skill.name).toBe('unknown');
    expect(skill.bodyContent).toContain('# No Frontmatter Skill');
  });
});

describe('loadSkillsFromDirectory', () => {
  beforeEach(async () => {
    await setupTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  it('should load all skills from directory', async () => {
    // Create test skills
    const skill1Dir = join(SKILLS_DIR, 'skill-one');
    const skill2Dir = join(SKILLS_DIR, 'skill-two');
    await mkdir(skill1Dir, { recursive: true });
    await mkdir(skill2Dir, { recursive: true });

    await writeFile(
      join(skill1Dir, 'SKILL.md'),
      `---\nname: skill-one\nversion: 1.0.0\n---\nContent 1`
    );
    await writeFile(
      join(skill2Dir, 'SKILL.md'),
      `---\nname: skill-two\nversion: 2.0.0\n---\nContent 2`
    );

    const skills = await loadSkillsFromDirectory(SKILLS_DIR);

    expect(skills.size).toBe(2);
    expect(skills.has('skill-one')).toBe(true);
    expect(skills.has('skill-two')).toBe(true);
  });

  it('should return empty map for non-existent directory', async () => {
    const skills = await loadSkillsFromDirectory('/non/existent/path');
    expect(skills.size).toBe(0);
  });

  it('should skip directories without SKILL.md', async () => {
    const emptyDir = join(SKILLS_DIR, 'empty-skill');
    await mkdir(emptyDir, { recursive: true });

    const skills = await loadSkillsFromDirectory(SKILLS_DIR);
    expect(skills.has('empty-skill')).toBe(false);
  });
});
