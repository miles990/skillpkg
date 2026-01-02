/**
 * DependencyResolver tests
 */
import { describe, it, expect } from 'vitest';
import {
  DependencyResolver,
  createDependencyResolver,
  createMockFetcher,
  CircularDependencyError,
} from '../dependency-resolver.js';
import type { SkillMetadata } from '../types.js';

describe('DependencyResolver', () => {
  // Helper to create a mock skills map
  function createSkillsMap(
    skills: Array<{
      name: string;
      version?: string;
      source?: string;
      deps?: { skills?: string[]; mcp?: string[] };
    }>
  ): Map<string, SkillMetadata> {
    const map = new Map<string, SkillMetadata>();
    for (const skill of skills) {
      const source = skill.source || skill.name;
      map.set(source, {
        name: skill.name,
        version: skill.version || '1.0.0',
        dependencies: skill.deps,
      });
    }
    return map;
  }

  describe('resolveDependencies', () => {
    it('should resolve skill with no dependencies', async () => {
      const skills = createSkillsMap([{ name: 'standalone-skill' }]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('standalone-skill');

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].name).toBe('standalone-skill');
      expect(result.dependencies[0].transitive).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('should resolve single-level dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'main-skill', deps: { skills: ['dep-a', 'dep-b'] } },
        { name: 'dep-a' },
        { name: 'dep-b' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('main-skill');

      expect(result.dependencies).toHaveLength(3);
      // Dependencies should come first (topological order)
      const names = result.dependencies.map((d) => d.name);
      expect(names.indexOf('dep-a')).toBeLessThan(names.indexOf('main-skill'));
      expect(names.indexOf('dep-b')).toBeLessThan(names.indexOf('main-skill'));
    });

    it('should resolve multi-level dependencies (A→B→C)', async () => {
      const skills = createSkillsMap([
        { name: 'skill-a', deps: { skills: ['skill-b'] } },
        { name: 'skill-b', deps: { skills: ['skill-c'] } },
        { name: 'skill-c' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('skill-a');

      expect(result.dependencies).toHaveLength(3);
      const names = result.dependencies.map((d) => d.name);
      // C comes first, then B, then A
      expect(names).toEqual(['skill-c', 'skill-b', 'skill-a']);
    });

    it('should mark transitive dependencies correctly', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['dep'] } },
        { name: 'dep' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('main');

      const main = result.dependencies.find((d) => d.name === 'main');
      const dep = result.dependencies.find((d) => d.name === 'dep');

      expect(main?.transitive).toBe(false);
      expect(dep?.transitive).toBe(true);
      expect(dep?.requiredBy).toBe('main');
    });

    it('should skip already installed skills', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['installed-dep'] } },
        { name: 'installed-dep' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));
      const installed = new Set(['installed-dep']);

      const result = await resolver.resolveDependencies('main', installed);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].name).toBe('main');
    });

    it('should collect MCP dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['dep'], mcp: ['cipher'] } },
        { name: 'dep', deps: { mcp: ['context7'] } },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('main');

      expect(result.mcpToInstall).toContain('cipher');
      expect(result.mcpToInstall).toContain('context7');
    });

    it('should deduplicate MCP dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['dep'], mcp: ['cipher'] } },
        { name: 'dep', deps: { mcp: ['cipher'] } }, // Same MCP
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('main');

      expect(result.mcpToInstall.filter((m) => m === 'cipher')).toHaveLength(1);
    });

    it('should handle diamond dependencies', async () => {
      // A depends on B and C, both B and C depend on D
      const skills = createSkillsMap([
        { name: 'a', deps: { skills: ['b', 'c'] } },
        { name: 'b', deps: { skills: ['d'] } },
        { name: 'c', deps: { skills: ['d'] } },
        { name: 'd' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('a');

      // D should only appear once
      const dCount = result.dependencies.filter((d) => d.name === 'd').length;
      expect(dCount).toBe(1);
      // D should come before B and C
      const names = result.dependencies.map((d) => d.name);
      expect(names.indexOf('d')).toBeLessThan(names.indexOf('b'));
      expect(names.indexOf('d')).toBeLessThan(names.indexOf('c'));
    });
  });

  describe('circular dependency detection', () => {
    it('should detect simple circular dependency (A→B→A)', async () => {
      const skills = createSkillsMap([
        { name: 'a', deps: { skills: ['b'] } },
        { name: 'b', deps: { skills: ['a'] } },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('a');

      expect(result.circularChain).toBeDefined();
      expect(result.errors.some((e) => e.includes('Circular'))).toBe(true);
    });

    it('should detect complex circular dependency (A→B→C→A)', async () => {
      const skills = createSkillsMap([
        { name: 'a', deps: { skills: ['b'] } },
        { name: 'b', deps: { skills: ['c'] } },
        { name: 'c', deps: { skills: ['a'] } },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('a');

      expect(result.circularChain).toBeDefined();
      expect(result.circularChain?.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect self-dependency', async () => {
      const skills = createSkillsMap([{ name: 'self', deps: { skills: ['self'] } }]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('self');

      expect(result.circularChain).toBeDefined();
    });
  });

  describe('buildDependencyTree', () => {
    it('should build tree for skill with dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'main', version: '2.0.0', deps: { skills: ['dep'], mcp: ['cipher'] } },
        { name: 'dep', version: '1.0.0' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const tree = await resolver.buildDependencyTree('main');

      expect(tree).not.toBeNull();
      expect(tree?.name).toBe('main');
      expect(tree?.version).toBe('2.0.0');
      expect(tree?.dependencies).toHaveLength(1);
      expect(tree?.dependencies[0].name).toBe('dep');
      expect(tree?.mcpDependencies).toContain('cipher');
    });

    it('should handle missing skill', async () => {
      const skills = createSkillsMap([]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const tree = await resolver.buildDependencyTree('nonexistent');

      expect(tree).toBeNull();
    });
  });

  describe('detectCircular', () => {
    it('should return null for non-circular dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['dep'] } },
        { name: 'dep' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const circular = await resolver.detectCircular('main');

      expect(circular).toBeNull();
    });

    it('should return chain for circular dependencies', async () => {
      const skills = createSkillsMap([
        { name: 'a', deps: { skills: ['b'] } },
        { name: 'b', deps: { skills: ['a'] } },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const circular = await resolver.detectCircular('a');

      expect(circular).not.toBeNull();
      expect(circular?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getDirectDependencies', () => {
    it('should return direct dependencies only', async () => {
      const skills = createSkillsMap([
        { name: 'main', deps: { skills: ['a', 'b'], mcp: ['cipher'] } },
        { name: 'a', deps: { skills: ['c'] } },
        { name: 'b' },
        { name: 'c' },
      ]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const deps = await resolver.getDirectDependencies('main');

      expect(deps.skills).toEqual(['a', 'b']);
      expect(deps.mcp).toEqual(['cipher']);
    });

    it('should return empty for skill with no dependencies', async () => {
      const skills = createSkillsMap([{ name: 'standalone' }]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const deps = await resolver.getDirectDependencies('standalone');

      expect(deps.skills).toEqual([]);
      expect(deps.mcp).toEqual([]);
    });
  });

  describe('source name extraction', () => {
    it('should extract name from github source', async () => {
      const skills = new Map<string, SkillMetadata>();
      skills.set('github:user/my-skill', {
        name: 'my-skill',
        version: '1.0.0',
      });
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('github:user/my-skill');

      expect(result.dependencies[0].name).toBe('my-skill');
    });

    it('should extract name from URL', async () => {
      const skills = new Map<string, SkillMetadata>();
      skills.set('https://github.com/user/my-skill', {
        name: 'my-skill',
        version: '1.0.0',
      });
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('https://github.com/user/my-skill');

      expect(result.dependencies[0].name).toBe('my-skill');
    });
  });

  describe('error handling', () => {
    it('should record errors for missing dependencies', async () => {
      const skills = createSkillsMap([{ name: 'main', deps: { skills: ['missing'] } }]);
      const resolver = createDependencyResolver(createMockFetcher(skills));

      const result = await resolver.resolveDependencies('main');

      expect(result.errors.some((e) => e.includes('missing'))).toBe(true);
    });
  });
});

describe('CircularDependencyError', () => {
  it('should contain chain information', () => {
    const error = new CircularDependencyError(['a', 'b', 'c', 'a']);

    expect(error.chain).toEqual(['a', 'b', 'c', 'a']);
    expect(error.message).toContain('a → b → c → a');
    expect(error.name).toBe('CircularDependencyError');
  });
});
