/**
 * Skill Matching Engine
 *
 * Analyzes user goals and recommends relevant skills based on
 * keyword matching with configurable weights.
 */

import type { SkillTriggers } from '../skill/types.js';
import type {
  MatchingWeights,
  MatchingOptions,
  SkillData,
  SkillMatch,
  SkillRecommendation,
} from './types.js';
import { DEFAULT_WEIGHTS } from './types.js';

/**
 * Priority order for sorting (higher = better)
 */
const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Skill Matching Engine
 */
export class MatchingEngine {
  private weights: MatchingWeights;
  private minConfidence: number;
  private researchThreshold: number;
  private maxResults: number;

  constructor(options: MatchingOptions = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    this.minConfidence = options.minConfidence ?? 0.3;
    this.researchThreshold = options.researchThreshold ?? 0.5;
    this.maxResults = options.maxResults ?? 5;
  }

  /**
   * Extract keywords from user goal
   */
  extractKeywords(goal: string): string[] {
    // Normalize: lowercase and split by common delimiters
    const normalized = goal.toLowerCase();

    // Split by spaces, punctuation, and common separators
    const words = normalized
      .split(/[\s,.\-_:;!?()[\]{}'"、。，！？]+/)
      .filter((word) => word.length > 1);

    // Remove common stop words (basic set for both English and Chinese)
    const stopWords = new Set([
      // English
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'dare',
      'ought',
      'used',
      'want',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'if',
      'or',
      'because',
      'until',
      'while',
      'about',
      'against',
      'i',
      'me',
      'my',
      'myself',
      'we',
      'our',
      'you',
      'your',
      'he',
      'him',
      'his',
      'she',
      'her',
      'it',
      'its',
      'they',
      'them',
      'their',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'am',
      // Chinese
      '的',
      '了',
      '是',
      '在',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一個',
      '上',
      '也',
      '很',
      '到',
      '說',
      '要',
      '去',
      '你',
      '會',
      '著',
      '沒有',
      '看',
      '好',
      '自己',
      '這',
      '那',
      '什麼',
      '嗎',
      '想',
      '他',
      '她',
      '它',
      '們',
      '來',
      '讓',
      '把',
      '給',
      '用',
      '做',
      '幫',
      '能',
      '可以',
      '需要',
      '想要',
      '請',
      '怎麼',
      '如何',
    ]);

    return words.filter((word) => !stopWords.has(word));
  }

  /**
   * Normalize triggers to structured format
   */
  private normalizeTriggers(triggers?: string[] | SkillTriggers): SkillTriggers {
    if (!triggers) {
      return {};
    }

    // Legacy format: array of strings -> treat as primary keywords
    if (Array.isArray(triggers)) {
      return {
        keywords: {
          primary: triggers.map((t) => t.toLowerCase()),
          secondary: [],
        },
        context_boost: [],
        context_penalty: [],
        priority: 'medium',
      };
    }

    // Normalize all keywords to lowercase
    return {
      keywords: {
        primary: (triggers.keywords?.primary || []).map((k) => k.toLowerCase()),
        secondary: (triggers.keywords?.secondary || []).map((k) => k.toLowerCase()),
      },
      context_boost: (triggers.context_boost || []).map((k) => k.toLowerCase()),
      context_penalty: (triggers.context_penalty || []).map((k) => k.toLowerCase()),
      priority: triggers.priority || 'medium',
    };
  }

  /**
   * Calculate match score for a skill
   */
  private calculateScore(
    keywords: string[],
    triggers: SkillTriggers
  ): { score: number; matchedKeywords: string[]; matchType: 'primary' | 'secondary' | 'mixed' } {
    let score = 0;
    const matchedKeywords: string[] = [];
    let hasPrimary = false;
    let hasSecondary = false;

    const primarySet = new Set(triggers.keywords?.primary || []);
    const secondarySet = new Set(triggers.keywords?.secondary || []);
    const boostSet = new Set(triggers.context_boost || []);
    const penaltySet = new Set(triggers.context_penalty || []);

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // Check primary keywords
      if (primarySet.has(lowerKeyword)) {
        score += this.weights.primary;
        matchedKeywords.push(keyword);
        hasPrimary = true;
      }
      // Check secondary keywords
      else if (secondarySet.has(lowerKeyword)) {
        score += this.weights.secondary;
        matchedKeywords.push(keyword);
        hasSecondary = true;
      }

      // Check context boost
      if (boostSet.has(lowerKeyword)) {
        score += this.weights.contextBoost;
      }

      // Check context penalty
      if (penaltySet.has(lowerKeyword)) {
        score += this.weights.contextPenalty; // This is negative
      }
    }

    // Determine match type
    let matchType: 'primary' | 'secondary' | 'mixed' = 'secondary';
    if (hasPrimary && hasSecondary) {
      matchType = 'mixed';
    } else if (hasPrimary) {
      matchType = 'primary';
    }

    return { score, matchedKeywords, matchType };
  }

  /**
   * Calculate confidence from score (normalized to 0-1)
   */
  private calculateConfidence(score: number): number {
    // Normalize score to 0-1 range
    // Score of 2.0 or higher = 1.0 confidence
    const confidence = Math.min(score / 2.0, 1.0);
    return Math.max(0, confidence);
  }

  /**
   * Match a single skill against keywords
   */
  matchSkill(skill: SkillData, keywords: string[]): SkillMatch | null {
    const triggers = this.normalizeTriggers(skill.triggers);
    const { score, matchedKeywords, matchType } = this.calculateScore(keywords, triggers);

    if (matchedKeywords.length === 0) {
      return null;
    }

    const confidence = this.calculateConfidence(score);

    if (confidence < this.minConfidence) {
      return null;
    }

    const priority = triggers.priority || 'medium';

    return {
      name: skill.name,
      confidence,
      matchedKeywords,
      matchType,
      priority,
      reason: this.generateReason(skill, matchedKeywords, matchType),
    };
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private generateReason(
    _skill: SkillData,
    matchedKeywords: string[],
    matchType: 'primary' | 'secondary' | 'mixed'
  ): string {
    const keywordStr = matchedKeywords.slice(0, 3).join(', ');
    const moreCount = matchedKeywords.length - 3;

    if (matchType === 'primary') {
      return `Direct match for "${keywordStr}"${moreCount > 0 ? ` +${moreCount} more` : ''}`;
    } else if (matchType === 'mixed') {
      return `Strong match for "${keywordStr}"${moreCount > 0 ? ` +${moreCount} more` : ''}`;
    } else {
      return `Related to "${keywordStr}"${moreCount > 0 ? ` +${moreCount} more` : ''}`;
    }
  }

  /**
   * Match skills against a user goal
   */
  matchSkills(
    goal: string,
    skills: SkillData[]
  ): { matches: SkillMatch[]; extractedKeywords: string[] } {
    const keywords = this.extractKeywords(goal);
    const matches: SkillMatch[] = [];

    for (const skill of skills) {
      const match = this.matchSkill(skill, keywords);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by confidence (desc), then priority (desc), then name (asc)
    matches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      matches: matches.slice(0, this.maxResults),
      extractedKeywords: keywords,
    };
  }

  /**
   * Analyze a goal and return full recommendation
   */
  analyze(goal: string, skills: SkillData[]): SkillRecommendation {
    const keywords = this.extractKeywords(goal);

    // Separate domain and software skills
    const domainSkills = skills.filter((s) => s.type === 'domain');
    const softwareSkills = skills.filter((s) => s.type === 'software');

    // Match both types
    const domainMatches = this.matchSkills(goal, domainSkills);
    const softwareMatches = this.matchSkills(goal, softwareSkills);

    // Collect software skills from domain skill dependencies
    const fromDependencies = new Set<string>();
    for (const match of domainMatches.matches) {
      const skill = domainSkills.find((s) => s.name === match.name);
      if (skill?.dependencies?.['software-skills']) {
        for (const dep of skill.dependencies['software-skills']) {
          fromDependencies.add(dep);
        }
      }
    }

    // Calculate overall confidence
    const allMatches = [...domainMatches.matches, ...softwareMatches.matches];
    const overallConfidence =
      allMatches.length > 0
        ? allMatches.reduce((sum, m) => sum + m.confidence, 0) / allMatches.length
        : 0;

    // Determine if research mode should be triggered
    const researchMode = overallConfidence < this.researchThreshold;

    // Generate research suggestions if in research mode
    const researchSuggestions = researchMode ? this.generateResearchSuggestions(goal, keywords) : undefined;

    return {
      goal,
      extractedKeywords: keywords,
      domain_skills: domainMatches.matches,
      software_skills: softwareMatches.matches,
      from_dependencies: Array.from(fromDependencies),
      overall_confidence: overallConfidence,
      research_mode: researchMode,
      research_suggestions: researchSuggestions,
    };
  }

  /**
   * Generate research suggestions when confidence is low
   */
  private generateResearchSuggestions(goal: string, keywords: string[]): string[] {
    const suggestions: string[] = [];

    // Suggest searching for skills related to main keywords
    if (keywords.length > 0) {
      suggestions.push(`Search external skill registries for: ${keywords.slice(0, 3).join(', ')}`);
    }

    // Suggest web search for domain knowledge
    suggestions.push(`Web search for best practices: "${goal}"`);

    // Suggest asking user for clarification
    suggestions.push('Ask user to clarify specific requirements or technologies');

    return suggestions;
  }
}
