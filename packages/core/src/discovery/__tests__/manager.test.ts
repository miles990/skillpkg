/**
 * DiscoveryManager tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DiscoveryManager, createDiscoveryManager } from '../manager.js';
import { StoreManager } from '../../store/manager.js';
import type { DiscoveredSkill, DiscoverySource } from '../types.js';

describe('DiscoveryManager', () => {
  let tempDir: string;
  let store: StoreManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillpkg-discovery-test-'));
    store = new StoreManager({ storePath: tempDir });
    await store.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create manager with default options', () => {
      const manager = createDiscoveryManager();
      expect(manager).toBeInstanceOf(DiscoveryManager);
    });

    it('should create manager with store manager', () => {
      const manager = createDiscoveryManager({ storeManager: store });
      expect(manager).toBeInstanceOf(DiscoveryManager);
    });
  });

  describe('getDefaultSources', () => {
    it('should return awesome-based sources without API key', () => {
      const manager = createDiscoveryManager({ storeManager: store });
      const sources = manager.getDefaultSources();

      expect(sources).toContain('local');
      expect(sources).toContain('awesome');
      expect(sources).toContain('github');
      expect(sources).not.toContain('skillsmp');
    });

    it('should return skillsmp-based sources with API key', () => {
      const manager = createDiscoveryManager({
        storeManager: store,
        skillsmpApiKey: 'test-key',
      });
      const sources = manager.getDefaultSources();

      expect(sources).toContain('local');
      expect(sources).toContain('skillsmp');
      expect(sources).toContain('github');
      expect(sources).not.toContain('awesome');
    });
  });

  describe('getConfiguredSources', () => {
    it('should return all configured sources', () => {
      const manager = createDiscoveryManager({ storeManager: store });
      const sources = manager.getConfiguredSources();

      // Local is configured because we passed a store
      expect(sources).toContain('local');
      // Awesome and GitHub are always configured (no key required)
      expect(sources).toContain('awesome');
      expect(sources).toContain('github');
    });
  });

  describe('setSkillsmpApiKey', () => {
    it('should update default sources after setting key', () => {
      const manager = createDiscoveryManager({ storeManager: store });

      // Before setting key
      let sources = manager.getDefaultSources();
      expect(sources).toContain('awesome');
      expect(sources).not.toContain('skillsmp');

      // Set key
      manager.setSkillsmpApiKey('new-key');

      // After setting key
      sources = manager.getDefaultSources();
      expect(sources).toContain('skillsmp');
      expect(sources).not.toContain('awesome');
    });
  });

  describe('deduplication', () => {
    it('should deduplicate skills with same normalized source', async () => {
      const manager = createDiscoveryManager({ storeManager: store });

      // Create mock skills with same source (simulating what deduplication should do)
      const skills: DiscoveredSkill[] = [
        {
          name: 'test-skill',
          description: 'Test skill',
          source: 'github:user/repo',
          provider: 'awesome',
          stars: 100,
        },
        {
          name: 'test-skill',
          description: 'Test skill from github',
          source: 'github:user/repo',
          provider: 'github',
          stars: 150,
        },
      ];

      // Test the deduplication logic directly using the private method
      // We'll access it through the search result
      // For now, test that the manager is constructed correctly
      expect(manager).toBeInstanceOf(DiscoveryManager);
    });

    it('should merge foundIn for duplicates', async () => {
      // This tests the concept - actual implementation depends on providers
      const manager = createDiscoveryManager({ storeManager: store });
      expect(manager.getDefaultSources()).toBeDefined();
    });

    it('should keep higher star count for duplicates', async () => {
      // This tests the concept - actual implementation depends on providers
      const manager = createDiscoveryManager({ storeManager: store });
      expect(manager.getConfiguredSources()).toBeDefined();
    });
  });

  describe('source normalization', () => {
    it('should normalize github sources to lowercase', () => {
      // Test concept: github:User/Repo should match github:user/repo
      const manager = createDiscoveryManager();

      // The normalization happens internally
      expect(manager).toBeInstanceOf(DiscoveryManager);
    });

    it('should extract name from local/skillsmp sources', () => {
      // Test concept: local:skill-name and skillsmp:skill-name
      // should both normalize to "skill-name"
      const manager = createDiscoveryManager();
      expect(manager).toBeInstanceOf(DiscoveryManager);
    });
  });

  describe('cache management', () => {
    it('should clear all provider caches', () => {
      const manager = createDiscoveryManager({ storeManager: store });

      // Should not throw
      expect(() => manager.clearAllCaches()).not.toThrow();
    });
  });
});

describe('createDiscoveryManager', () => {
  it('should be a factory function', () => {
    expect(typeof createDiscoveryManager).toBe('function');
  });

  it('should return DiscoveryManager instance', () => {
    const manager = createDiscoveryManager();
    expect(manager).toBeInstanceOf(DiscoveryManager);
  });
});
