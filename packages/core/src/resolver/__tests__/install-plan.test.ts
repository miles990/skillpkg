/**
 * InstallPlan tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInstallPlan,
  recordDependencyInstall,
  getSkillsToInstall,
  getInstallCount,
  hasMcpRequirements,
  formatInstallPlan,
  type InstallStep,
} from '../install-plan.js';
import type { ResolutionResult } from '../types.js';
import type { StateManager } from '../../state/index.js';

describe('createInstallPlan', () => {
  it('should create plan from resolution with no dependencies', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'standalone', source: 'github:user/standalone', type: 'skill', transitive: false },
      ],
      mcpToInstall: [],
      errors: [],
    };

    const plan = createInstallPlan(resolution);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].name).toBe('standalone');
    expect(plan.steps[0].action).toBe('install');
    expect(plan.steps[0].isTransitive).toBe(false);
    expect(plan.hasErrors).toBe(false);
  });

  it('should create plan with transitive dependencies', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'dep', source: 'github:user/dep', type: 'skill', transitive: true, requiredBy: 'main' },
        { name: 'main', source: 'github:user/main', type: 'skill', transitive: false },
      ],
      mcpToInstall: [],
      errors: [],
    };

    const plan = createInstallPlan(resolution);

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].name).toBe('dep');
    expect(plan.steps[0].isTransitive).toBe(true);
    expect(plan.steps[0].requiredBy).toBe('main');
    expect(plan.steps[1].name).toBe('main');
  });

  it('should skip already installed skills', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'installed', source: 'github:user/installed', type: 'skill', transitive: true, requiredBy: 'main' },
        { name: 'main', source: 'github:user/main', type: 'skill', transitive: false },
      ],
      mcpToInstall: [],
      errors: [],
    };
    const installed = new Set(['installed']);

    const plan = createInstallPlan(resolution, installed);

    expect(plan.steps[0].action).toBe('skip');
    expect(plan.steps[0].skipReason).toBe('Already installed');
    expect(plan.steps[1].action).toBe('install');
  });

  it('should include MCP requirements', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'main', source: 'github:user/main', type: 'skill', transitive: false },
      ],
      mcpToInstall: ['cipher', 'context7'],
      errors: [],
    };

    const plan = createInstallPlan(resolution);

    expect(plan.mcpRequirements).toHaveLength(2);
    expect(plan.mcpRequirements[0].name).toBe('cipher');
    expect(plan.mcpRequirements[1].name).toBe('context7');
  });

  it('should handle circular dependency detection', () => {
    const resolution: ResolutionResult = {
      dependencies: [],
      mcpToInstall: [],
      errors: ['Circular dependency detected: a → b → a'],
      circularChain: ['a', 'b', 'a'],
    };

    const plan = createInstallPlan(resolution);

    expect(plan.hasErrors).toBe(true);
    expect(plan.circularChain).toEqual(['a', 'b', 'a']);
    expect(plan.steps).toHaveLength(0);
  });

  it('should preserve errors from resolution', () => {
    const resolution: ResolutionResult = {
      dependencies: [],
      mcpToInstall: [],
      errors: ['Failed to fetch: missing-skill'],
    };

    const plan = createInstallPlan(resolution);

    expect(plan.hasErrors).toBe(true);
    expect(plan.errors).toContain('Failed to fetch: missing-skill');
  });
});

describe('recordDependencyInstall', () => {
  let mockStateManager: StateManager;
  const projectPath = '/test/project';

  beforeEach(() => {
    mockStateManager = {
      recordSkillInstall: vi.fn().mockResolvedValue(undefined),
      addDependency: vi.fn().mockResolvedValue(undefined),
    } as unknown as StateManager;
  });

  it('should record user installation', async () => {
    const step: InstallStep = {
      name: 'my-skill',
      source: 'github:user/my-skill',
      isTransitive: false,
      action: 'install',
    };

    await recordDependencyInstall(projectPath, mockStateManager, step, '1.0.0');

    expect(mockStateManager.recordSkillInstall).toHaveBeenCalledWith(
      projectPath,
      'my-skill',
      {
        version: '1.0.0',
        source: 'github:user/my-skill',
        installed_by: 'user',
      }
    );
    expect(mockStateManager.addDependency).not.toHaveBeenCalled();
  });

  it('should record transitive dependency with depended_by', async () => {
    const step: InstallStep = {
      name: 'dep-skill',
      source: 'github:user/dep-skill',
      isTransitive: true,
      requiredBy: 'main-skill',
      action: 'install',
    };

    await recordDependencyInstall(projectPath, mockStateManager, step, '2.0.0');

    expect(mockStateManager.recordSkillInstall).toHaveBeenCalledWith(
      projectPath,
      'dep-skill',
      {
        version: '2.0.0',
        source: 'github:user/dep-skill',
        installed_by: 'main-skill',
      }
    );
    expect(mockStateManager.addDependency).toHaveBeenCalledWith(
      projectPath,
      'main-skill',
      'dep-skill'
    );
  });
});

describe('helper functions', () => {
  describe('getSkillsToInstall', () => {
    it('should return only install actions', () => {
      const resolution: ResolutionResult = {
        dependencies: [
          { name: 'skip-me', source: 's', type: 'skill', transitive: false },
          { name: 'install-me', source: 's', type: 'skill', transitive: false },
        ],
        mcpToInstall: [],
        errors: [],
      };
      const plan = createInstallPlan(resolution, new Set(['skip-me']));

      const toInstall = getSkillsToInstall(plan);

      expect(toInstall).toHaveLength(1);
      expect(toInstall[0].name).toBe('install-me');
    });
  });

  describe('getInstallCount', () => {
    it('should count install actions', () => {
      const resolution: ResolutionResult = {
        dependencies: [
          { name: 'a', source: 's', type: 'skill', transitive: false },
          { name: 'b', source: 's', type: 'skill', transitive: false },
          { name: 'c', source: 's', type: 'skill', transitive: false },
        ],
        mcpToInstall: [],
        errors: [],
      };
      const plan = createInstallPlan(resolution, new Set(['a']));

      expect(getInstallCount(plan)).toBe(2);
    });
  });

  describe('hasMcpRequirements', () => {
    it('should return true when MCP is required', () => {
      const resolution: ResolutionResult = {
        dependencies: [],
        mcpToInstall: ['cipher'],
        errors: [],
      };
      const plan = createInstallPlan(resolution);

      expect(hasMcpRequirements(plan)).toBe(true);
    });

    it('should return false when no MCP required', () => {
      const resolution: ResolutionResult = {
        dependencies: [],
        mcpToInstall: [],
        errors: [],
      };
      const plan = createInstallPlan(resolution);

      expect(hasMcpRequirements(plan)).toBe(false);
    });
  });
});

describe('formatInstallPlan', () => {
  it('should format plan with skills to install', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'dep', source: 's', type: 'skill', transitive: true, requiredBy: 'main' },
        { name: 'main', source: 's', type: 'skill', transitive: false },
      ],
      mcpToInstall: [],
      errors: [],
    };
    const plan = createInstallPlan(resolution);

    const output = formatInstallPlan(plan);

    expect(output).toContain('Skills to install:');
    expect(output).toContain('+ dep');
    expect(output).toContain('(required by main)');
    expect(output).toContain('+ main');
  });

  it('should format plan with skipped skills', () => {
    const resolution: ResolutionResult = {
      dependencies: [
        { name: 'installed', source: 's', type: 'skill', transitive: false },
        { name: 'new', source: 's', type: 'skill', transitive: false },
      ],
      mcpToInstall: [],
      errors: [],
    };
    const plan = createInstallPlan(resolution, new Set(['installed']));

    const output = formatInstallPlan(plan);

    expect(output).toContain('Skills already installed:');
    expect(output).toContain('= installed');
  });

  it('should format plan with MCP requirements', () => {
    const resolution: ResolutionResult = {
      dependencies: [],
      mcpToInstall: ['cipher', 'context7'],
      errors: [],
    };
    const plan = createInstallPlan(resolution);

    const output = formatInstallPlan(plan);

    expect(output).toContain('MCP servers required:');
    expect(output).toContain('! cipher');
    expect(output).toContain('! context7');
  });

  it('should format circular dependency error', () => {
    const resolution: ResolutionResult = {
      dependencies: [],
      mcpToInstall: [],
      errors: ['Circular dependency'],
      circularChain: ['a', 'b', 'c', 'a'],
    };
    const plan = createInstallPlan(resolution);

    const output = formatInstallPlan(plan);

    expect(output).toContain('Circular dependency detected: a → b → c → a');
  });

  it('should format errors', () => {
    const resolution: ResolutionResult = {
      dependencies: [],
      mcpToInstall: [],
      errors: ['Failed to fetch: missing'],
    };
    const plan = createInstallPlan(resolution);

    const output = formatInstallPlan(plan);

    expect(output).toContain('Errors:');
    expect(output).toContain('- Failed to fetch: missing');
  });
});
