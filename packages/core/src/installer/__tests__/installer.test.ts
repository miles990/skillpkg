/**
 * Installer tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { Installer, createInstaller } from '../installer.js';
import type { SkillFetcherAdapter, InstallOptions, UninstallOptions } from '../types.js';
import { StateManager, createStateManager } from '../../state/index.js';
import { ConfigManager, createConfigManager } from '../../config/index.js';
import { StoreManager } from '../../store/manager.js';
import type { Skill } from '../../types.js';

// Test directories
const TEST_DIR = join(process.cwd(), '.test-installer');
const PROJECT_DIR = join(TEST_DIR, 'project');
const STORE_DIR = join(TEST_DIR, 'store');

// Mock skill data - must include 'schema' field for validation
const mockSkills: Record<string, Skill> = {
  'skill-a': {
    schema: '1.0',
    name: 'skill-a',
    version: '1.0.0',
    description: 'Skill A description text',
    instructions: 'Instructions for A',
  },
  'skill-b': {
    schema: '1.0',
    name: 'skill-b',
    version: '2.0.0',
    description: 'Skill B with dependency on A',
    instructions: 'Instructions for B',
  },
  'skill-c': {
    schema: '1.0',
    name: 'skill-c',
    version: '1.5.0',
    description: 'Skill C standalone',
    instructions: 'Instructions for C',
  },
};

// Mock metadata with dependencies
const mockMetadata: Record<
  string,
  { name: string; version: string; dependencies?: { skills?: string[]; mcp?: string[] } }
> = {
  'github:user/skill-a': { name: 'skill-a', version: '1.0.0' },
  'github:user/skill-b': {
    name: 'skill-b',
    version: '2.0.0',
    dependencies: { skills: ['github:user/skill-a'] },
  },
  'github:user/skill-c': { name: 'skill-c', version: '1.5.0' },
  'github:user/skill-with-mcp': {
    name: 'skill-with-mcp',
    version: '1.0.0',
    dependencies: { mcp: ['mcp-server-a'] },
  },
};

// Create mock fetcher
function createMockFetcher(): SkillFetcherAdapter {
  return {
    async fetchMetadata(source: string) {
      const meta = mockMetadata[source];
      return meta || null;
    },
    async fetchSkill(source: string) {
      const meta = mockMetadata[source];
      if (!meta) return null;
      const skill = mockSkills[meta.name];
      return skill || null;
    },
  };
}

// Setup helpers
async function setupTestDirs(): Promise<void> {
  await mkdir(PROJECT_DIR, { recursive: true });
  await mkdir(STORE_DIR, { recursive: true });
  await mkdir(join(STORE_DIR, 'skills'), { recursive: true });
}

async function cleanupTestDirs(): Promise<void> {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
}

async function initProject(name: string): Promise<void> {
  const config = {
    $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
    name,
    skills: {},
    sync_targets: { 'claude-code': true },
  };
  await writeFile(join(PROJECT_DIR, 'skillpkg.json'), JSON.stringify(config, null, 2));
}

describe('Installer', () => {
  let stateManager: StateManager;
  let configManager: ConfigManager;
  let storeManager: StoreManager;
  let fetcher: SkillFetcherAdapter;
  let installer: Installer;

  beforeEach(async () => {
    await setupTestDirs();

    stateManager = createStateManager();
    configManager = createConfigManager();
    storeManager = new StoreManager({ storePath: STORE_DIR });
    await storeManager.init();
    fetcher = createMockFetcher();

    installer = createInstaller(stateManager, configManager, storeManager, fetcher);
  });

  afterEach(async () => {
    await cleanupTestDirs();
  });

  describe('install', () => {
    it('should install a single skill without dependencies', async () => {
      await initProject('test-project');

      const result = await installer.install(PROJECT_DIR, 'github:user/skill-a');

      expect(result.success).toBe(true);
      expect(result.stats.installed).toBe(1);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('skill-a');
      expect(result.skills[0].action).toBe('installed');

      // Verify skill is in store
      const skill = await storeManager.getSkill('skill-a');
      expect(skill).not.toBeNull();
      expect(skill?.version).toBe('1.0.0');
    });

    it('should install a skill with its dependencies', async () => {
      await initProject('test-project');

      const result = await installer.install(PROJECT_DIR, 'github:user/skill-b');

      expect(result.success).toBe(true);
      expect(result.stats.installed).toBe(2);

      // Both skills should be installed
      const skillA = await storeManager.getSkill('skill-a');
      const skillB = await storeManager.getSkill('skill-b');
      expect(skillA).not.toBeNull();
      expect(skillB).not.toBeNull();

      // Dependency should be marked as transitive
      const depSkill = result.skills.find((s) => s.name === 'skill-a');
      expect(depSkill?.transitive).toBe(true);
      expect(depSkill?.requiredBy).toBe('skill-b');
    });

    it('should skip already installed skills', async () => {
      await initProject('test-project');

      // Install skill-a first
      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      // Now install skill-b which depends on skill-a
      const result = await installer.install(PROJECT_DIR, 'github:user/skill-b');

      expect(result.success).toBe(true);
      expect(result.stats.installed).toBe(1);
      expect(result.stats.skipped).toBe(1);

      const skipped = result.skills.find((s) => s.action === 'skipped');
      expect(skipped?.name).toBe('skill-a');
    });

    it('should return error for non-existent skill', async () => {
      await initProject('test-project');

      const result = await installer.install(PROJECT_DIR, 'github:user/non-existent');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report MCP requirements', async () => {
      await initProject('test-project');

      // Add mock for skill with MCP
      mockSkills['skill-with-mcp'] = {
        schema: '1.0',
        name: 'skill-with-mcp',
        version: '1.0.0',
        description: 'Skill with MCP dependency',
        instructions: 'Instructions',
      };

      const result = await installer.install(PROJECT_DIR, 'github:user/skill-with-mcp');

      expect(result.success).toBe(true);
      expect(result.mcpRequired).toContain('mcp-server-a');
    });

    it('should support dry run mode', async () => {
      await initProject('test-project');

      const result = await installer.install(PROJECT_DIR, 'github:user/skill-a', {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.stats.installed).toBe(1);

      // Skill should NOT be in store
      const skill = await storeManager.getSkill('skill-a');
      expect(skill).toBeNull();
    });

    it('should skip dependencies when skipDependencies is true', async () => {
      await initProject('test-project');

      const result = await installer.install(PROJECT_DIR, 'github:user/skill-b', {
        skipDependencies: true,
      });

      expect(result.success).toBe(true);
      expect(result.stats.installed).toBe(1);

      // Only skill-b should be installed
      const skillA = await storeManager.getSkill('skill-a');
      const skillB = await storeManager.getSkill('skill-b');
      expect(skillA).toBeNull();
      expect(skillB).not.toBeNull();
    });

    it('should update skillpkg.json after installation', async () => {
      await initProject('test-project');

      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      const config = await configManager.loadProjectConfig(PROJECT_DIR);
      expect(config?.skills?.['skill-a']).toBe('github:user/skill-a');
    });
  });

  describe('uninstall', () => {
    it('should uninstall a skill', async () => {
      await initProject('test-project');

      // Install first
      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      // Then uninstall
      const result = await installer.uninstall(PROJECT_DIR, 'skill-a');

      expect(result.success).toBe(true);
      expect(result.removed).toContain('skill-a');

      // Verify skill is removed from store
      const skill = await storeManager.getSkill('skill-a');
      expect(skill).toBeNull();
    });

    it('should prevent uninstalling skill with dependents', async () => {
      await initProject('test-project');

      // Install skill-b (which depends on skill-a)
      await installer.install(PROJECT_DIR, 'github:user/skill-b');

      // Try to uninstall skill-a
      const result = await installer.uninstall(PROJECT_DIR, 'skill-a');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('required by');

      // skill-a should still exist
      const skill = await storeManager.getSkill('skill-a');
      expect(skill).not.toBeNull();
    });

    it('should force uninstall even with dependents', async () => {
      await initProject('test-project');

      // Install skill-b (which depends on skill-a)
      await installer.install(PROJECT_DIR, 'github:user/skill-b');

      // Force uninstall skill-a
      const result = await installer.uninstall(PROJECT_DIR, 'skill-a', { force: true });

      expect(result.success).toBe(true);
      expect(result.removed).toContain('skill-a');
    });

    it('should return error for non-existent skill', async () => {
      await initProject('test-project');

      const result = await installer.uninstall(PROJECT_DIR, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('should support dry run mode', async () => {
      await initProject('test-project');

      // Install first
      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      // Dry run uninstall
      const result = await installer.uninstall(PROJECT_DIR, 'skill-a', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.removed).toContain('skill-a');

      // Skill should still exist
      const skill = await storeManager.getSkill('skill-a');
      expect(skill).not.toBeNull();
    });

    it('should remove skill from skillpkg.json', async () => {
      await initProject('test-project');

      // Install
      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      // Verify it's in config
      let config = await configManager.loadProjectConfig(PROJECT_DIR);
      expect(config?.skills?.['skill-a']).toBeDefined();

      // Uninstall
      await installer.uninstall(PROJECT_DIR, 'skill-a');

      // Verify it's removed from config
      config = await configManager.loadProjectConfig(PROJECT_DIR);
      expect(config?.skills?.['skill-a']).toBeUndefined();
    });
  });

  describe('canUninstall', () => {
    it('should return true for skills without dependents', async () => {
      await initProject('test-project');

      await installer.install(PROJECT_DIR, 'github:user/skill-a');

      const check = await installer.canUninstall(PROJECT_DIR, 'skill-a');

      expect(check.canUninstall).toBe(true);
      expect(check.dependents).toHaveLength(0);
    });

    it('should return false for skills with dependents', async () => {
      await initProject('test-project');

      await installer.install(PROJECT_DIR, 'github:user/skill-b');

      const check = await installer.canUninstall(PROJECT_DIR, 'skill-a');

      expect(check.canUninstall).toBe(false);
      expect(check.dependents).toContain('skill-b');
    });
  });

  describe('installFromConfig', () => {
    it('should install all skills from skillpkg.json', async () => {
      // Create config with multiple skills
      const config = {
        $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
        name: 'test-project',
        skills: {
          'skill-a': 'github:user/skill-a',
          'skill-c': 'github:user/skill-c',
        },
        sync_targets: { 'claude-code': true },
      };
      await writeFile(join(PROJECT_DIR, 'skillpkg.json'), JSON.stringify(config, null, 2));

      const result = await installer.installFromConfig(PROJECT_DIR);

      expect(result.success).toBe(true);
      expect(result.skills.length).toBe(2);

      // Both skills should be installed
      const skillA = await storeManager.getSkill('skill-a');
      const skillC = await storeManager.getSkill('skill-c');
      expect(skillA).not.toBeNull();
      expect(skillC).not.toBeNull();
    });

    it('should return error when no skillpkg.json exists', async () => {
      // Don't create skillpkg.json

      const result = await installer.installFromConfig(PROJECT_DIR);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No skillpkg.json');
    });

    it('should succeed with empty skills in config', async () => {
      await initProject('test-project');

      const result = await installer.installFromConfig(PROJECT_DIR);

      expect(result.success).toBe(true);
      expect(result.skills).toHaveLength(0);
    });
  });
});

describe('createInstaller', () => {
  it('should create an Installer instance', async () => {
    await setupTestDirs();

    const stateManager = createStateManager();
    const configManager = createConfigManager();
    const storeManager = new StoreManager({ storePath: STORE_DIR });
    const fetcher = createMockFetcher();

    const installer = createInstaller(stateManager, configManager, storeManager, fetcher);

    expect(installer).toBeInstanceOf(Installer);

    await cleanupTestDirs();
  });
});
