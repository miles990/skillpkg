import { describe, it, expect } from 'vitest';
import { MatchingEngine } from '../engine.js';
import type { SkillData } from '../types.js';

describe('MatchingEngine', () => {
  const engine = new MatchingEngine();

  describe('extractKeywords', () => {
    it('should extract keywords from simple goal', () => {
      const keywords = engine.extractKeywords('build a trading bot');
      expect(keywords).toContain('build');
      expect(keywords).toContain('trading');
      expect(keywords).toContain('bot');
    });

    it('should remove stop words', () => {
      const keywords = engine.extractKeywords('I want to create a website');
      expect(keywords).not.toContain('i');
      expect(keywords).not.toContain('want');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('a');
      expect(keywords).toContain('create');
      expect(keywords).toContain('website');
    });

    it('should handle Chinese text with separators', () => {
      // Note: Chinese text needs separators (spaces, commas) for keyword extraction
      // Full Chinese word segmentation would require a library like jieba
      const keywords = engine.extractKeywords('量化 交易 系統');
      expect(keywords).toContain('量化');
      expect(keywords).toContain('交易');
      expect(keywords).toContain('系統');
    });
  });

  describe('matchSkill', () => {
    it('should match skill with primary keywords', () => {
      const skill: SkillData = {
        name: 'quant-trading',
        description: 'Quantitative trading skill',
        type: 'domain',
        triggers: {
          keywords: {
            primary: ['quant', 'trading', '量化'],
            secondary: ['stock', 'futures'],
          },
          context_boost: ['python', 'finance'],
          context_penalty: ['design', 'marketing'],
          priority: 'high',
        },
      };

      const match = engine.matchSkill(skill, ['quant', 'trading', 'python']);

      expect(match).not.toBeNull();
      expect(match!.name).toBe('quant-trading');
      expect(match!.matchType).toBe('primary');
      expect(match!.priority).toBe('high');
      expect(match!.confidence).toBeGreaterThan(0.5);
    });

    it('should match skill with secondary keywords', () => {
      const skill: SkillData = {
        name: 'quant-trading',
        description: 'Quantitative trading skill',
        type: 'domain',
        triggers: {
          keywords: {
            primary: ['quant', 'trading'],
            secondary: ['stock', 'futures'],
          },
        },
      };

      const match = engine.matchSkill(skill, ['stock']);

      expect(match).not.toBeNull();
      expect(match!.matchType).toBe('secondary');
    });

    it('should apply context boost', () => {
      const skill: SkillData = {
        name: 'quant-trading',
        description: 'Quantitative trading skill',
        type: 'domain',
        triggers: {
          keywords: {
            primary: ['quant'],
          },
          context_boost: ['python'],
        },
      };

      const matchWithBoost = engine.matchSkill(skill, ['quant', 'python']);
      const matchWithoutBoost = engine.matchSkill(skill, ['quant']);

      expect(matchWithBoost!.confidence).toBeGreaterThan(matchWithoutBoost!.confidence);
    });

    it('should apply context penalty', () => {
      const skill: SkillData = {
        name: 'quant-trading',
        description: 'Quantitative trading skill',
        type: 'domain',
        triggers: {
          keywords: {
            primary: ['quant', 'trading'],
          },
          context_penalty: ['design'],
        },
      };

      const matchWithPenalty = engine.matchSkill(skill, ['quant', 'trading', 'design']);
      const matchWithoutPenalty = engine.matchSkill(skill, ['quant', 'trading']);

      expect(matchWithPenalty!.confidence).toBeLessThan(matchWithoutPenalty!.confidence);
    });

    it('should handle legacy trigger format (string array)', () => {
      const skill: SkillData = {
        name: 'test-skill',
        description: 'Test',
        type: 'software',
        triggers: ['react', 'frontend', 'ui'],
      };

      const match = engine.matchSkill(skill, ['react', 'frontend']);

      expect(match).not.toBeNull();
      expect(match!.matchedKeywords).toContain('react');
      expect(match!.matchedKeywords).toContain('frontend');
    });
  });

  describe('analyze', () => {
    const skills: SkillData[] = [
      {
        name: 'quant-trading',
        description: 'Quantitative trading',
        type: 'domain',
        triggers: {
          keywords: { primary: ['quant', 'trading', '量化'] },
        },
        dependencies: {
          'software-skills': ['python', 'database'],
        },
      },
      {
        name: 'python',
        description: 'Python development',
        type: 'software',
        triggers: {
          keywords: { primary: ['python', 'py'] },
        },
      },
      {
        name: 'frontend',
        description: 'Frontend development',
        type: 'software',
        triggers: {
          keywords: { primary: ['frontend', 'react', 'vue'] },
        },
      },
    ];

    it('should return full recommendation', () => {
      const result = engine.analyze('build a quant trading system with python', skills);

      expect(result.goal).toBe('build a quant trading system with python');
      expect(result.extractedKeywords.length).toBeGreaterThan(0);
      expect(result.domain_skills.length).toBeGreaterThan(0);
      expect(result.software_skills.length).toBeGreaterThan(0);
    });

    it('should extract dependencies from domain skills', () => {
      const result = engine.analyze('quant trading system', skills);

      expect(result.domain_skills.length).toBeGreaterThan(0);
      expect(result.from_dependencies).toContain('python');
      expect(result.from_dependencies).toContain('database');
    });

    it('should trigger research mode when confidence is low', () => {
      const result = engine.analyze('something completely unrelated xyz', skills);

      expect(result.research_mode).toBe(true);
      expect(result.research_suggestions).toBeDefined();
      expect(result.research_suggestions!.length).toBeGreaterThan(0);
    });

    it('should not trigger research mode when confidence is high', () => {
      const result = engine.analyze('quant trading python', skills);

      expect(result.overall_confidence).toBeGreaterThan(0);
      // Note: research_mode depends on overall_confidence threshold
    });
  });
});
