/**
 * Types for skill matching engine
 */

import type { SkillTriggers } from '../skill/types.js';

/**
 * Matching weights configuration
 */
export interface MatchingWeights {
  /** Weight for primary keyword matches (default: 1.0) */
  primary: number;
  /** Weight for secondary keyword matches (default: 0.6) */
  secondary: number;
  /** Bonus for context_boost matches (default: 0.2) */
  contextBoost: number;
  /** Penalty for context_penalty matches (default: -0.3) */
  contextPenalty: number;
}

/**
 * Default matching weights
 */
export const DEFAULT_WEIGHTS: MatchingWeights = {
  primary: 1.0,
  secondary: 0.6,
  contextBoost: 0.2,
  contextPenalty: -0.3,
};

/**
 * Individual skill match result
 */
export interface SkillMatch {
  /** Skill name */
  name: string;
  /** Match confidence score (0-1) */
  confidence: number;
  /** Keywords that matched */
  matchedKeywords: string[];
  /** Match type (primary or secondary) */
  matchType: 'primary' | 'secondary' | 'mixed';
  /** Priority from skill triggers */
  priority: 'high' | 'medium' | 'low';
  /** Reason for recommendation */
  reason: string;
}

/**
 * Skill recommendation result from matching engine
 */
export interface SkillRecommendation {
  /** Original user goal/query */
  goal: string;
  /** Extracted keywords from goal */
  extractedKeywords: string[];
  /** Matched domain skills */
  domain_skills: SkillMatch[];
  /** Matched software skills */
  software_skills: SkillMatch[];
  /** Software skills from domain skill dependencies */
  from_dependencies: string[];
  /** Overall confidence score (0-1) */
  overall_confidence: number;
  /** Whether research mode should be triggered (confidence < 0.5) */
  research_mode: boolean;
  /** Suggested research topics if research_mode is true */
  research_suggestions?: string[];
}

/**
 * Skill data for matching
 */
export interface SkillData {
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Skill type */
  type: 'domain' | 'software';
  /** Triggers configuration */
  triggers?: string[] | SkillTriggers;
  /** Dependencies */
  dependencies?: {
    skills?: string[];
    'software-skills'?: string[];
  };
}

/**
 * Matching engine options
 */
export interface MatchingOptions {
  /** Custom weights */
  weights?: Partial<MatchingWeights>;
  /** Minimum confidence threshold (default: 0.3) */
  minConfidence?: number;
  /** Research mode threshold (default: 0.5) */
  researchThreshold?: number;
  /** Maximum results per category (default: 5) */
  maxResults?: number;
}
