/**
 * Registry management tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createEmptyRegistry,
  loadRegistry,
  saveRegistry,
  addSkillToRegistry,
  removeSkillFromRegistry,
  getSkillFromRegistry,
  listSkillsInRegistry,
  updateSyncedPlatforms,
} from '../registry.js';

describe('registry', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createEmptyRegistry', () => {
    it('should create registry with version and empty skills', () => {
      const registry = createEmptyRegistry();

      expect(registry.version).toBe('1.0');
      expect(registry.skills).toEqual({});
      expect(registry.lastUpdated).toBeDefined();
    });
  });

  describe('loadRegistry', () => {
    it('should return empty registry if file does not exist', async () => {
      const registry = await loadRegistry(tempDir);

      expect(registry.version).toBe('1.0');
      expect(registry.skills).toEqual({});
    });

    it('should load existing registry', async () => {
      const existingRegistry = {
        version: '1.0',
        skills: {
          'my-skill': {
            name: 'my-skill',
            version: '1.0.0',
            installedAt: '2024-01-01T00:00:00.000Z',
            source: 'local' as const,
            syncedPlatforms: [],
          },
        },
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      const registryPath = join(tempDir, 'registry.json');
      const { writeFile, mkdir } = await import('fs/promises');
      await mkdir(tempDir, { recursive: true });
      await writeFile(registryPath, JSON.stringify(existingRegistry));

      const registry = await loadRegistry(tempDir);

      expect(registry.skills['my-skill']).toBeDefined();
      expect(registry.skills['my-skill'].version).toBe('1.0.0');
    });

    it('should return empty registry if file is corrupted', async () => {
      const registryPath = join(tempDir, 'registry.json');
      const { writeFile, mkdir } = await import('fs/promises');
      await mkdir(tempDir, { recursive: true });
      await writeFile(registryPath, 'not valid json');

      const registry = await loadRegistry(tempDir);

      expect(registry.version).toBe('1.0');
      expect(registry.skills).toEqual({});
    });
  });

  describe('saveRegistry', () => {
    it('should save registry to disk', async () => {
      const registry = createEmptyRegistry();
      registry.skills['test'] = {
        name: 'test',
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      };

      await saveRegistry(tempDir, registry);

      const content = await readFile(join(tempDir, 'registry.json'), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.skills['test']).toBeDefined();
      expect(saved.lastUpdated).toBeDefined();
    });

    it('should create parent directory if needed', async () => {
      const nestedDir = join(tempDir, 'nested', 'dir');
      const registry = createEmptyRegistry();

      await saveRegistry(nestedDir, registry);

      const content = await readFile(join(nestedDir, 'registry.json'), 'utf-8');
      expect(JSON.parse(content)).toBeDefined();
    });
  });

  describe('addSkillToRegistry', () => {
    it('should add new skill entry', async () => {
      await addSkillToRegistry(tempDir, 'new-skill', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'registry',
        syncedPlatforms: ['claude-code'],
      });

      const registry = await loadRegistry(tempDir);

      expect(registry.skills['new-skill']).toBeDefined();
      expect(registry.skills['new-skill'].name).toBe('new-skill');
      expect(registry.skills['new-skill'].version).toBe('1.0.0');
      expect(registry.skills['new-skill'].source).toBe('registry');
    });

    it('should update existing skill entry', async () => {
      await addSkillToRegistry(tempDir, 'my-skill', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      });

      await addSkillToRegistry(tempDir, 'my-skill', {
        version: '2.0.0',
        installedAt: '2024-02-01T00:00:00.000Z',
        source: 'registry',
        syncedPlatforms: ['claude-code'],
      });

      const registry = await loadRegistry(tempDir);

      expect(registry.skills['my-skill'].version).toBe('2.0.0');
      expect(registry.skills['my-skill'].source).toBe('registry');
    });
  });

  describe('removeSkillFromRegistry', () => {
    it('should remove existing skill', async () => {
      await addSkillToRegistry(tempDir, 'to-remove', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      });

      const result = await removeSkillFromRegistry(tempDir, 'to-remove');

      expect(result).toBe(true);

      const registry = await loadRegistry(tempDir);
      expect(registry.skills['to-remove']).toBeUndefined();
    });

    it('should return false if skill does not exist', async () => {
      const result = await removeSkillFromRegistry(tempDir, 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getSkillFromRegistry', () => {
    it('should return skill entry if exists', async () => {
      await addSkillToRegistry(tempDir, 'my-skill', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      });

      const entry = await getSkillFromRegistry(tempDir, 'my-skill');

      expect(entry).not.toBeNull();
      expect(entry?.name).toBe('my-skill');
    });

    it('should return null if skill does not exist', async () => {
      const entry = await getSkillFromRegistry(tempDir, 'non-existent');
      expect(entry).toBeNull();
    });
  });

  describe('listSkillsInRegistry', () => {
    it('should return empty array for empty registry', async () => {
      const skills = await listSkillsInRegistry(tempDir);
      expect(skills).toEqual([]);
    });

    it('should return all skills', async () => {
      await addSkillToRegistry(tempDir, 'skill-a', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      });

      await addSkillToRegistry(tempDir, 'skill-b', {
        version: '2.0.0',
        installedAt: '2024-01-02T00:00:00.000Z',
        source: 'registry',
        syncedPlatforms: ['claude-code'],
      });

      const skills = await listSkillsInRegistry(tempDir);

      expect(skills).toHaveLength(2);
      expect(skills.map(s => s.name).sort()).toEqual(['skill-a', 'skill-b']);
    });
  });

  describe('updateSyncedPlatforms', () => {
    it('should update synced platforms for existing skill', async () => {
      await addSkillToRegistry(tempDir, 'my-skill', {
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00.000Z',
        source: 'local',
        syncedPlatforms: [],
      });

      await updateSyncedPlatforms(tempDir, 'my-skill', ['claude-code', 'codex']);

      const entry = await getSkillFromRegistry(tempDir, 'my-skill');

      expect(entry?.syncedPlatforms).toEqual(['claude-code', 'codex']);
      expect(entry?.lastSynced).toBeDefined();
    });

    it('should not throw for non-existent skill', async () => {
      await expect(
        updateSyncedPlatforms(tempDir, 'non-existent', ['claude-code'])
      ).resolves.not.toThrow();
    });
  });
});
