/**
 * StoreManager tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StoreManager, createGlobalStore, createLocalStore } from '../store-manager.js';
import type { Skill } from '../../types.js';

describe('StoreManager', () => {
  let tempDir: string;
  let store: StoreManager;

  const mockSkill: Skill = {
    schema: '1.0',
    name: 'test-skill',
    version: '1.0.0',
    description: 'A test skill',
    author: 'Test Author',
    platforms: {
      'claude-code': {},
    },
    instructions: 'Do something useful',
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-store-test-'));
    store = new StoreManager({ storePath: tempDir });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use custom store path', () => {
      const customStore = new StoreManager({ storePath: '/custom/path' });
      expect(customStore.getStoreDir()).toBe('/custom/path');
    });
  });

  describe('init', () => {
    it('should create store directory structure', async () => {
      await store.init();

      const skillsDir = join(tempDir, 'skills');
      const registryPath = join(tempDir, 'registry.json');
      const configPath = join(tempDir, 'config.json');

      expect(existsSync(skillsDir)).toBe(true);
      expect(existsSync(registryPath)).toBe(true);
      expect(existsSync(configPath)).toBe(true);
    });
  });

  describe('isInitialized', () => {
    it('should return false for uninitialized store', async () => {
      const result = await store.isInitialized();
      expect(result).toBe(false);
    });

    it('should return true after init', async () => {
      await store.init();
      const result = await store.isInitialized();
      expect(result).toBe(true);
    });
  });

  describe('skill operations', () => {
    beforeEach(async () => {
      await store.init();
    });

    describe('addSkill', () => {
      it('should add skill to store', async () => {
        await store.addSkill(mockSkill);

        const skill = await store.getSkill('test-skill');
        expect(skill).not.toBeNull();
        expect(skill?.name).toBe('test-skill');
        expect(skill?.version).toBe('1.0.0');
      });

      it('should create skill directory', async () => {
        await store.addSkill(mockSkill);

        const skillDir = join(tempDir, 'skills', 'test-skill');
        expect(existsSync(skillDir)).toBe(true);
      });

      it('should update registry', async () => {
        await store.addSkill(mockSkill, { source: 'registry' });

        const entry = await store.getSkillEntry('test-skill');
        expect(entry).not.toBeNull();
        expect(entry?.source).toBe('registry');
      });
    });

    describe('getSkill', () => {
      it('should return null for non-existent skill', async () => {
        const skill = await store.getSkill('non-existent');
        expect(skill).toBeNull();
      });

      it('should return skill if exists', async () => {
        await store.addSkill(mockSkill);

        const skill = await store.getSkill('test-skill');
        expect(skill?.description).toBe('A test skill');
      });
    });

    describe('listSkills', () => {
      it('should return empty array for empty store', async () => {
        const skills = await store.listSkills();
        expect(skills).toEqual([]);
      });

      it('should return all skills with metadata', async () => {
        await store.addSkill(mockSkill, { source: 'local' });
        await store.addSkill(
          { ...mockSkill, name: 'another-skill', version: '2.0.0' },
          { source: 'registry' }
        );

        const skills = await store.listSkills();

        expect(skills).toHaveLength(2);
        expect(skills.map(s => s.name).sort()).toEqual(['another-skill', 'test-skill']);
      });
    });

    describe('updateSkill', () => {
      it('should update existing skill', async () => {
        await store.addSkill(mockSkill);

        const updated = { ...mockSkill, version: '2.0.0', description: 'Updated' };
        await store.updateSkill('test-skill', updated);

        const skill = await store.getSkill('test-skill');
        expect(skill?.version).toBe('2.0.0');
        expect(skill?.description).toBe('Updated');
      });

      it('should throw for non-existent skill', async () => {
        await expect(
          store.updateSkill('non-existent', mockSkill)
        ).rejects.toThrow('Skill not found');
      });
    });

    describe('removeSkill', () => {
      it('should remove skill and directory', async () => {
        await store.addSkill(mockSkill);

        const result = await store.removeSkill('test-skill');

        expect(result).toBe(true);
        expect(await store.getSkill('test-skill')).toBeNull();
        expect(existsSync(join(tempDir, 'skills', 'test-skill'))).toBe(false);
      });

      it('should return false for non-existent skill', async () => {
        const result = await store.removeSkill('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('hasSkill', () => {
      it('should return true for existing skill', async () => {
        await store.addSkill(mockSkill);
        expect(await store.hasSkill('test-skill')).toBe(true);
      });

      it('should return false for non-existent skill', async () => {
        expect(await store.hasSkill('non-existent')).toBe(false);
      });
    });

    describe('updateSyncedPlatforms', () => {
      it('should update synced platforms', async () => {
        await store.addSkill(mockSkill);

        await store.updateSyncedPlatforms('test-skill', ['claude-code', 'codex']);

        const entry = await store.getSkillEntry('test-skill');
        expect(entry?.syncedPlatforms).toEqual(['claude-code', 'codex']);
      });
    });
  });

  describe('registry operations', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('should get and save registry', async () => {
      const registry = await store.getRegistry();
      registry.skills['test'] = {
        name: 'test',
        version: '1.0.0',
        installedAt: new Date().toISOString(),
        source: 'local',
        syncedPlatforms: [],
      };

      await store.saveRegistry(registry);

      const loaded = await store.getRegistry();
      expect(loaded.skills['test']).toBeDefined();
    });
  });

  describe('config operations', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('should get and save config', async () => {
      const config = await store.getConfig();
      config.autoSync = false;

      await store.saveConfig(config);

      const loaded = await store.getConfig();
      expect(loaded.autoSync).toBe(false);
    });

    it('should set specific config value', async () => {
      await store.setConfigValue('registry', 'https://custom.dev');

      const config = await store.getConfig();
      expect(config.registry).toBe('https://custom.dev');
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await store.init();
    });

    describe('getSkillNames', () => {
      it('should return all skill directory names', async () => {
        await store.addSkill(mockSkill);
        await store.addSkill({ ...mockSkill, name: 'skill-b' });

        const names = await store.getSkillNames();

        expect(names.sort()).toEqual(['skill-b', 'test-skill']);
      });
    });

    describe('cleanOrphans', () => {
      it('should remove orphaned registry entries', async () => {
        // Add to registry but not create directory
        const registry = await store.getRegistry();
        registry.skills['orphan'] = {
          name: 'orphan',
          version: '1.0.0',
          installedAt: new Date().toISOString(),
          source: 'local',
          syncedPlatforms: [],
        };
        await store.saveRegistry(registry);

        const orphans = await store.cleanOrphans();

        expect(orphans).toContain('orphan');

        const cleaned = await store.getRegistry();
        expect(cleaned.skills['orphan']).toBeUndefined();
      });
    });
  });
});

describe('factory functions', () => {
  describe('createGlobalStore', () => {
    it('should create store with global directory', () => {
      const store = createGlobalStore();
      expect(store.getStoreDir()).toContain('.skillpkg');
    });
  });

  describe('createLocalStore', () => {
    it('should create store with local directory', () => {
      const store = createLocalStore('/my/project');
      expect(store.getStoreDir()).toBe(join('/my/project', '.skillpkg'));
    });
  });
});
