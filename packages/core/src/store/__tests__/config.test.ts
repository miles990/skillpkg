/**
 * Configuration management tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getDefaultConfig,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  updateConfig,
  resetConfig,
} from '../config.js';

describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config.registry).toBe('https://registry.skillpkg.dev');
      expect(config.registries).toEqual({});
      expect(config.defaultPlatforms).toEqual(['claude-code', 'codex', 'copilot', 'cline']);
      expect(config.autoSync).toBe(true);
      expect(config.ui).toEqual({
        port: 3737,
        openBrowser: true,
      });
      expect(config.mcp).toEqual({
        enabled: true,
        port: 3838,
      });
    });
  });

  describe('loadConfig', () => {
    it('should return default config if file does not exist', async () => {
      const config = await loadConfig(tempDir);

      expect(config.registry).toBe('https://registry.skillpkg.dev');
      expect(config.autoSync).toBe(true);
    });

    it('should load and merge with defaults', async () => {
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({
          registry: 'https://custom.registry.dev',
          autoSync: false,
        })
      );

      const config = await loadConfig(tempDir);

      // Custom values
      expect(config.registry).toBe('https://custom.registry.dev');
      expect(config.autoSync).toBe(false);

      // Default values preserved
      expect(config.defaultPlatforms).toEqual(['claude-code', 'codex', 'copilot', 'cline']);
      expect(config.ui.port).toBe(3737);
    });

    it('should deep merge nested objects', async () => {
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({
          ui: {
            port: 4000,
          },
        })
      );

      const config = await loadConfig(tempDir);

      expect(config.ui.port).toBe(4000);
      expect(config.ui.openBrowser).toBe(true); // Default preserved
    });

    it('should return defaults for corrupted file', async () => {
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, 'config.json'), 'not valid json {{{');

      const config = await loadConfig(tempDir);

      expect(config.registry).toBe('https://registry.skillpkg.dev');
    });
  });

  describe('saveConfig', () => {
    it('should save config to disk', async () => {
      const config = getDefaultConfig();
      config.registry = 'https://my.registry.dev';

      await saveConfig(tempDir, config);

      const content = await readFile(join(tempDir, 'config.json'), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.registry).toBe('https://my.registry.dev');
    });

    it('should create parent directory if needed', async () => {
      const nestedDir = join(tempDir, 'nested', 'config');
      const config = getDefaultConfig();

      await saveConfig(nestedDir, config);

      const content = await readFile(join(nestedDir, 'config.json'), 'utf-8');
      expect(JSON.parse(content)).toBeDefined();
    });
  });

  describe('getConfigValue', () => {
    it('should return specific config value', async () => {
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({
          autoSync: false,
        })
      );

      const value = await getConfigValue(tempDir, 'autoSync');
      expect(value).toBe(false);
    });

    it('should return default value if not set', async () => {
      const value = await getConfigValue(tempDir, 'registry');
      expect(value).toBe('https://registry.skillpkg.dev');
    });
  });

  describe('setConfigValue', () => {
    it('should set specific config value', async () => {
      await setConfigValue(tempDir, 'autoSync', false);

      const config = await loadConfig(tempDir);
      expect(config.autoSync).toBe(false);
    });

    it('should preserve other values', async () => {
      await setConfigValue(tempDir, 'registry', 'https://custom.dev');
      await setConfigValue(tempDir, 'autoSync', false);

      const config = await loadConfig(tempDir);
      expect(config.registry).toBe('https://custom.dev');
      expect(config.autoSync).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update multiple values at once', async () => {
      await updateConfig(tempDir, {
        registry: 'https://new.registry.dev',
        autoSync: false,
        defaultPlatforms: ['claude-code'],
      });

      const config = await loadConfig(tempDir);

      expect(config.registry).toBe('https://new.registry.dev');
      expect(config.autoSync).toBe(false);
      expect(config.defaultPlatforms).toEqual(['claude-code']);
    });

    it('should deep merge nested objects', async () => {
      await updateConfig(tempDir, {
        ui: {
          port: 5000,
        },
      });

      const config = await loadConfig(tempDir);

      expect(config.ui.port).toBe(5000);
      expect(config.ui.openBrowser).toBe(true); // Default preserved
    });
  });

  describe('resetConfig', () => {
    it('should reset to default configuration', async () => {
      await updateConfig(tempDir, {
        registry: 'https://custom.dev',
        autoSync: false,
      });

      await resetConfig(tempDir);

      const config = await loadConfig(tempDir);

      expect(config.registry).toBe('https://registry.skillpkg.dev');
      expect(config.autoSync).toBe(true);
    });
  });
});
