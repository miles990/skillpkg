/**
 * Path utilities tests
 */
import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import {
  getGlobalDir,
  getLocalDir,
  getSkillsDir,
  getSkillDir,
  getSkillYamlPath,
  getRegistryPath,
  getConfigPath,
  getCredentialsPath,
  getCacheDir,
} from '../paths.js';

describe('paths', () => {
  describe('getGlobalDir', () => {
    it('should return ~/.skillpkg', () => {
      const result = getGlobalDir();
      expect(result).toBe(join(homedir(), '.skillpkg'));
    });
  });

  describe('getLocalDir', () => {
    it('should return .skillpkg in specified project path', () => {
      const result = getLocalDir('/my/project');
      expect(result).toBe(join('/my/project', '.skillpkg'));
    });

    it('should use cwd by default', () => {
      // Just verify it returns a path ending with .skillpkg
      const result = getLocalDir();
      expect(result).toMatch(/\.skillpkg$/);
    });
  });

  describe('getSkillsDir', () => {
    it('should return skills subdirectory', () => {
      const result = getSkillsDir('/base');
      expect(result).toBe(join('/base', 'skills'));
    });
  });

  describe('getSkillDir', () => {
    it('should return skill-specific directory', () => {
      const result = getSkillDir('/base', 'my-skill');
      expect(result).toBe(join('/base', 'skills', 'my-skill'));
    });
  });

  describe('getSkillYamlPath', () => {
    it('should return skill.yaml path', () => {
      const result = getSkillYamlPath('/base', 'my-skill');
      expect(result).toBe(join('/base', 'skills', 'my-skill', 'skill.yaml'));
    });
  });

  describe('getRegistryPath', () => {
    it('should return registry.json path', () => {
      const result = getRegistryPath('/base');
      expect(result).toBe(join('/base', 'registry.json'));
    });
  });

  describe('getConfigPath', () => {
    it('should return config.json path', () => {
      const result = getConfigPath('/base');
      expect(result).toBe(join('/base', 'config.json'));
    });
  });

  describe('getCredentialsPath', () => {
    it('should return credentials.json path', () => {
      const result = getCredentialsPath('/base');
      expect(result).toBe(join('/base', 'credentials.json'));
    });
  });

  describe('getCacheDir', () => {
    it('should return cache subdirectory', () => {
      const result = getCacheDir('/base');
      expect(result).toBe(join('/base', 'cache'));
    });
  });
});
