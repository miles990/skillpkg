/**
 * StateManager tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StateManager, createStateManager, STATE_DIR, STATE_FILE_NAME } from '../state-manager.js';
import { createEmptyState, STATE_SCHEMA_VERSION } from '../types.js';

describe('StateManager', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-statemgr-test-'));
    manager = createStateManager();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getStatePath', () => {
    it('should return correct state path', () => {
      const path = manager.getStatePath('/project');
      expect(path).toBe(join('/project', STATE_DIR, STATE_FILE_NAME));
    });
  });

  describe('hasState', () => {
    it('should return false if state does not exist', () => {
      expect(manager.hasState(tempDir)).toBe(false);
    });

    it('should return true if state exists', async () => {
      await mkdir(join(tempDir, STATE_DIR), { recursive: true });
      await writeFile(join(tempDir, STATE_DIR, STATE_FILE_NAME), JSON.stringify(createEmptyState()));
      expect(manager.hasState(tempDir)).toBe(true);
    });
  });

  describe('loadState', () => {
    it('should return empty state if file does not exist', async () => {
      const state = await manager.loadState(tempDir);

      expect(state.$schema).toBe(STATE_SCHEMA_VERSION);
      expect(state.skills).toEqual({});
      expect(state.mcp).toEqual({});
      expect(state.sync_history).toEqual({});
    });

    it('should load valid state', async () => {
      const testState = {
        $schema: STATE_SCHEMA_VERSION,
        skills: {
          'my-skill': {
            version: '1.0.0',
            source: 'github:user/repo',
            installed_by: 'user',
            installed_at: '2024-01-01T00:00:00.000Z',
            depended_by: [],
          },
        },
        mcp: {},
        sync_history: {},
      };
      await mkdir(join(tempDir, STATE_DIR), { recursive: true });
      await writeFile(join(tempDir, STATE_DIR, STATE_FILE_NAME), JSON.stringify(testState));

      const state = await manager.loadState(tempDir);

      expect(state.skills['my-skill'].version).toBe('1.0.0');
    });

    it('should return empty state for corrupted file', async () => {
      await mkdir(join(tempDir, STATE_DIR), { recursive: true });
      await writeFile(join(tempDir, STATE_DIR, STATE_FILE_NAME), 'not valid json');

      const state = await manager.loadState(tempDir);
      expect(state.skills).toEqual({});
    });
  });

  describe('saveState', () => {
    it('should save state to disk', async () => {
      const state = createEmptyState();
      state.skills['test'] = {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
        installed_at: new Date().toISOString(),
        depended_by: [],
      };

      await manager.saveState(tempDir, state);

      const content = await readFile(join(tempDir, STATE_DIR, STATE_FILE_NAME), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.skills['test'].version).toBe('1.0.0');
    });

    it('should create directory if needed', async () => {
      const state = createEmptyState();
      await manager.saveState(tempDir, state);

      expect(manager.hasState(tempDir)).toBe(true);
    });
  });

  describe('recordSkillInstall', () => {
    it('should record skill installation', async () => {
      await manager.recordSkillInstall(tempDir, 'my-skill', {
        version: '1.0.0',
        source: 'github:user/repo',
        installed_by: 'user',
      });

      const state = await manager.loadState(tempDir);

      expect(state.skills['my-skill']).toBeDefined();
      expect(state.skills['my-skill'].version).toBe('1.0.0');
      expect(state.skills['my-skill'].source).toBe('github:user/repo');
      expect(state.skills['my-skill'].installed_by).toBe('user');
      expect(state.skills['my-skill'].depended_by).toEqual([]);
    });
  });

  describe('recordSkillUninstall', () => {
    it('should remove skill from state', async () => {
      await manager.recordSkillInstall(tempDir, 'my-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      await manager.recordSkillUninstall(tempDir, 'my-skill');

      const state = await manager.loadState(tempDir);
      expect(state.skills['my-skill']).toBeUndefined();
    });

    it('should remove from depended_by of other skills', async () => {
      // Install dependency skill
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      // Install dependent skill and add dependency
      await manager.recordSkillInstall(tempDir, 'main-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });
      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');

      // Verify dependency was added
      let state = await manager.loadState(tempDir);
      expect(state.skills['dep-skill'].depended_by).toContain('main-skill');

      // Uninstall main skill
      await manager.recordSkillUninstall(tempDir, 'main-skill');

      // Verify depended_by was cleaned up
      state = await manager.loadState(tempDir);
      expect(state.skills['dep-skill'].depended_by).not.toContain('main-skill');
    });
  });

  describe('recordMcpInstall', () => {
    it('should record MCP installation', async () => {
      await manager.recordMcpInstall(tempDir, 'cipher', {
        package: '@byterover/cipher',
        installed_by_skill: 'my-skill',
      });

      const state = await manager.loadState(tempDir);

      expect(state.mcp['cipher']).toBeDefined();
      expect(state.mcp['cipher'].package).toBe('@byterover/cipher');
      expect(state.mcp['cipher'].installed_by_skill).toBe('my-skill');
    });
  });

  describe('recordMcpUninstall', () => {
    it('should remove MCP from state', async () => {
      await manager.recordMcpInstall(tempDir, 'cipher', {
        package: '@byterover/cipher',
        installed_by_skill: null,
      });

      await manager.recordMcpUninstall(tempDir, 'cipher');

      const state = await manager.loadState(tempDir);
      expect(state.mcp['cipher']).toBeUndefined();
    });
  });

  describe('addDependency', () => {
    it('should add dependency relationship', async () => {
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');

      const state = await manager.loadState(tempDir);
      expect(state.skills['dep-skill'].depended_by).toContain('main-skill');
    });

    it('should throw if dependency skill not found', async () => {
      await expect(manager.addDependency(tempDir, 'main', 'nonexistent')).rejects.toThrow(
        'Dependency skill not found'
      );
    });

    it('should not add duplicate dependency', async () => {
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');
      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');

      const state = await manager.loadState(tempDir);
      const count = state.skills['dep-skill'].depended_by.filter(
        (d) => d === 'main-skill'
      ).length;
      expect(count).toBe(1);
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency relationship', async () => {
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });
      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');

      await manager.removeDependency(tempDir, 'main-skill', 'dep-skill');

      const state = await manager.loadState(tempDir);
      expect(state.skills['dep-skill'].depended_by).not.toContain('main-skill');
    });
  });

  describe('getDependents', () => {
    it('should return skills that depend on a skill', async () => {
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });
      await manager.addDependency(tempDir, 'skill-a', 'dep-skill');
      await manager.addDependency(tempDir, 'skill-b', 'dep-skill');

      const state = await manager.loadState(tempDir);
      const dependents = manager.getDependents(state, 'dep-skill');

      expect(dependents).toContain('skill-a');
      expect(dependents).toContain('skill-b');
    });

    it('should return empty array for nonexistent skill', async () => {
      const state = await manager.loadState(tempDir);
      const dependents = manager.getDependents(state, 'nonexistent');

      expect(dependents).toEqual([]);
    });
  });

  describe('canUninstall', () => {
    it('should return true if no dependents', async () => {
      await manager.recordSkillInstall(tempDir, 'my-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      const state = await manager.loadState(tempDir);
      const result = manager.canUninstall(state, 'my-skill');

      expect(result.canUninstall).toBe(true);
      expect(result.dependents).toEqual([]);
    });

    it('should return false if has dependents', async () => {
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });
      await manager.addDependency(tempDir, 'main-skill', 'dep-skill');

      const state = await manager.loadState(tempDir);
      const result = manager.canUninstall(state, 'dep-skill');

      expect(result.canUninstall).toBe(false);
      expect(result.dependents).toContain('main-skill');
    });
  });

  describe('getOrphanDependencies', () => {
    it('should return orphan dependencies', async () => {
      // Install main skill
      await manager.recordSkillInstall(tempDir, 'main-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      // Install dependency (installed by main-skill)
      await manager.recordSkillInstall(tempDir, 'dep-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'main-skill',
      });

      // Uninstall main-skill (but dep-skill remains)
      await manager.recordSkillUninstall(tempDir, 'main-skill');

      const state = await manager.loadState(tempDir);
      const orphans = manager.getOrphanDependencies(state);

      expect(orphans).toContain('dep-skill');
    });

    it('should not return skills installed by user', async () => {
      await manager.recordSkillInstall(tempDir, 'user-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      const state = await manager.loadState(tempDir);
      const orphans = manager.getOrphanDependencies(state);

      expect(orphans).not.toContain('user-skill');
    });
  });

  describe('recordSync', () => {
    it('should record sync timestamp', async () => {
      await manager.recordSync(tempDir, 'claude-code');

      const state = await manager.loadState(tempDir);
      expect(state.sync_history['claude-code']).toBeDefined();
    });
  });

  describe('getLastSync', () => {
    it('should return last sync time', async () => {
      await manager.recordSync(tempDir, 'claude-code');

      const state = await manager.loadState(tempDir);
      const lastSync = manager.getLastSync(state, 'claude-code');

      expect(lastSync).not.toBeNull();
    });

    it('should return null if never synced', async () => {
      const state = await manager.loadState(tempDir);
      const lastSync = manager.getLastSync(state, 'claude-code');

      expect(lastSync).toBeNull();
    });
  });

  describe('helper methods', () => {
    it('isSkillInstalled should check skill existence', async () => {
      await manager.recordSkillInstall(tempDir, 'my-skill', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      const state = await manager.loadState(tempDir);

      expect(manager.isSkillInstalled(state, 'my-skill')).toBe(true);
      expect(manager.isSkillInstalled(state, 'nonexistent')).toBe(false);
    });

    it('isMcpInstalled should check MCP existence', async () => {
      await manager.recordMcpInstall(tempDir, 'cipher', {
        package: '@byterover/cipher',
        installed_by_skill: null,
      });

      const state = await manager.loadState(tempDir);

      expect(manager.isMcpInstalled(state, 'cipher')).toBe(true);
      expect(manager.isMcpInstalled(state, 'nonexistent')).toBe(false);
    });

    it('getInstalledSkills should return all skill names', async () => {
      await manager.recordSkillInstall(tempDir, 'skill-a', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });
      await manager.recordSkillInstall(tempDir, 'skill-b', {
        version: '1.0.0',
        source: 'local',
        installed_by: 'user',
      });

      const state = await manager.loadState(tempDir);
      const skills = manager.getInstalledSkills(state);

      expect(skills).toContain('skill-a');
      expect(skills).toContain('skill-b');
    });

    it('getInstalledMcps should return all MCP names', async () => {
      await manager.recordMcpInstall(tempDir, 'cipher', {
        package: '@byterover/cipher',
        installed_by_skill: null,
      });
      await manager.recordMcpInstall(tempDir, 'context7', {
        package: '@context7/mcp',
        installed_by_skill: null,
      });

      const state = await manager.loadState(tempDir);
      const mcps = manager.getInstalledMcps(state);

      expect(mcps).toContain('cipher');
      expect(mcps).toContain('context7');
    });
  });
});
