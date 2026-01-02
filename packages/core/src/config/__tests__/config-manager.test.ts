/**
 * ConfigManager tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigManager, createConfigManager, CONFIG_FILE_NAME } from '../config-manager.js';
import { createDefaultConfig } from '../types.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-configmgr-test-'));
    manager = createConfigManager();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getConfigPath', () => {
    it('should return correct config path', () => {
      const path = manager.getConfigPath('/project');
      expect(path).toBe(join('/project', CONFIG_FILE_NAME));
    });
  });

  describe('hasConfig', () => {
    it('should return false if config does not exist', () => {
      expect(manager.hasConfig(tempDir)).toBe(false);
    });

    it('should return true if config exists', async () => {
      await writeFile(join(tempDir, CONFIG_FILE_NAME), JSON.stringify({ name: 'test' }));
      expect(manager.hasConfig(tempDir)).toBe(true);
    });
  });

  describe('loadProjectConfig', () => {
    it('should return null if config does not exist', async () => {
      const config = await manager.loadProjectConfig(tempDir);
      expect(config).toBeNull();
    });

    it('should load valid config', async () => {
      const testConfig = {
        $schema: 'https://skillpkg.dev/schemas/skillpkg.json',
        name: 'test-project',
        skills: { 'my-skill': 'github:user/repo' },
      };
      await writeFile(join(tempDir, CONFIG_FILE_NAME), JSON.stringify(testConfig));

      const config = await manager.loadProjectConfig(tempDir);

      expect(config).not.toBeNull();
      expect(config!.name).toBe('test-project');
      expect(config!.skills!['my-skill']).toBe('github:user/repo');
    });

    it('should throw on invalid JSON', async () => {
      await writeFile(join(tempDir, CONFIG_FILE_NAME), 'not valid json {{{');

      await expect(manager.loadProjectConfig(tempDir)).rejects.toThrow('Invalid JSON');
    });

    it('should throw on invalid schema', async () => {
      await writeFile(
        join(tempDir, CONFIG_FILE_NAME),
        JSON.stringify({ invalid: 'config' }) // Missing required 'name'
      );

      await expect(manager.loadProjectConfig(tempDir)).rejects.toThrow('Invalid skillpkg.json');
    });
  });

  describe('saveProjectConfig', () => {
    it('should save config to disk', async () => {
      const config = createDefaultConfig('test-project');

      await manager.saveProjectConfig(tempDir, config);

      const content = await readFile(join(tempDir, CONFIG_FILE_NAME), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.name).toBe('test-project');
      expect(saved.$schema).toBe('https://skillpkg.dev/schemas/skillpkg.json');
    });

    it('should throw on invalid config', async () => {
      const invalidConfig = { invalid: 'config' } as any;

      await expect(manager.saveProjectConfig(tempDir, invalidConfig)).rejects.toThrow(
        'Invalid configuration'
      );
    });
  });

  describe('initProject', () => {
    it('should create new skillpkg.json', async () => {
      const config = await manager.initProject(tempDir, 'my-project');

      expect(config.name).toBe('my-project');
      expect(manager.hasConfig(tempDir)).toBe(true);

      const loaded = await manager.loadProjectConfig(tempDir);
      expect(loaded!.name).toBe('my-project');
    });

    it('should throw if config already exists', async () => {
      await manager.initProject(tempDir, 'first-project');

      await expect(manager.initProject(tempDir, 'second-project')).rejects.toThrow(
        'already exists'
      );
    });

    it('should overwrite with force option', async () => {
      await manager.initProject(tempDir, 'first-project');
      await manager.initProject(tempDir, 'second-project', { force: true });

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.name).toBe('second-project');
    });
  });

  describe('addSkill', () => {
    it('should add skill to config', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.addSkill(tempDir, 'my-skill', 'github:user/repo');

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.skills!['my-skill']).toBe('github:user/repo');
    });

    it('should throw if no config exists', async () => {
      await expect(manager.addSkill(tempDir, 'skill', 'source')).rejects.toThrow(
        'No skillpkg.json found'
      );
    });
  });

  describe('removeSkill', () => {
    it('should remove skill from config', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.addSkill(tempDir, 'my-skill', 'github:user/repo');
      const removed = await manager.removeSkill(tempDir, 'my-skill');

      expect(removed).toBe(true);

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.skills!['my-skill']).toBeUndefined();
    });

    it('should return false if skill does not exist', async () => {
      await manager.initProject(tempDir, 'test');
      const removed = await manager.removeSkill(tempDir, 'nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('setMcp', () => {
    it('should add MCP to config', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.setMcp(tempDir, 'cipher', {
        package: '@byterover/cipher',
        command: 'cipher',
        args: ['--mode', 'mcp'],
      });

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.mcp!['cipher'].package).toBe('@byterover/cipher');
    });
  });

  describe('removeMcp', () => {
    it('should remove MCP from config', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.setMcp(tempDir, 'cipher', { package: '@byterover/cipher' });
      const removed = await manager.removeMcp(tempDir, 'cipher');

      expect(removed).toBe(true);

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.mcp!['cipher']).toBeUndefined();
    });
  });

  describe('setSyncTargets', () => {
    it('should update sync targets', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.setSyncTargets(tempDir, { 'claude-code': true, cursor: true });

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.sync_targets!['claude-code']).toBe(true);
      expect(config!.sync_targets!['cursor']).toBe(true);
    });
  });

  describe('addReminder', () => {
    it('should add reminder to config', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.addReminder(tempDir, 'Remember to test!');

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.reminders).toContain('Remember to test!');
    });

    it('should not add duplicate reminder', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.addReminder(tempDir, 'Remember!');
      await manager.addReminder(tempDir, 'Remember!');

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.reminders!.filter((r) => r === 'Remember!').length).toBe(1);
    });
  });

  describe('removeReminder', () => {
    it('should remove reminder by index', async () => {
      await manager.initProject(tempDir, 'test');
      await manager.addReminder(tempDir, 'First');
      await manager.addReminder(tempDir, 'Second');
      const removed = await manager.removeReminder(tempDir, 0);

      expect(removed).toBe(true);

      const config = await manager.loadProjectConfig(tempDir);
      expect(config!.reminders).toEqual(['Second']);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = createDefaultConfig('test');
      const result = manager.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject config without name', () => {
      const result = manager.validateConfig({ skills: {} });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes('name'))).toBe(true);
    });

    it('should reject config with additional properties', () => {
      const result = manager.validateConfig({
        name: 'test',
        unknownField: 'value',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('getEnabledSyncTargets', () => {
    it('should return default if no sync_targets', () => {
      const config = { name: 'test' };
      const targets = manager.getEnabledSyncTargets(config);

      expect(targets).toEqual(['claude-code']);
    });

    it('should return enabled targets', () => {
      const config = {
        name: 'test',
        sync_targets: {
          'claude-code': true,
          cursor: true,
          codex: false,
        },
      };
      const targets = manager.getEnabledSyncTargets(config);

      expect(targets).toContain('claude-code');
      expect(targets).toContain('cursor');
      expect(targets).not.toContain('codex');
    });
  });
});
