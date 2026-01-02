/**
 * Tool utilities - shared helpers for tool handlers
 */

import {
  createGlobalStore,
  createLocalStore,
  type StoreManager,
  createRegistryClient,
  type RegistryClient,
} from 'skillpkg-core';
import type { ToolResult, Scope } from '../types.js';

/**
 * Get the appropriate store based on scope
 */
export function getStore(scope: Scope, projectPath?: string): StoreManager {
  if (scope === 'global') {
    return createGlobalStore();
  }
  return createLocalStore(projectPath);
}

/**
 * Get registry client
 */
export function getRegistryClient(): RegistryClient {
  // Use GitHub-based registry
  return createRegistryClient({
    registryUrl: 'https://raw.githubusercontent.com/skillpkg/registry/main',
  });
}

/**
 * Create a success result
 */
export function successResult(data: unknown): ToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create an error result
 */
export function errorResult(message: string, suggestion?: string): ToolResult {
  let text = `Error: ${message}`;
  if (suggestion) {
    text += `\n\nSuggestion: ${suggestion}`;
  }
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

/**
 * Validate required string parameter
 */
export function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate optional string parameter
 */
export function validateOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.trim() || undefined;
}

/**
 * Validate scope parameter
 */
export function validateScope(value: unknown, defaultValue: Scope = 'local'): Scope {
  if (value === 'local' || value === 'global') {
    return value;
  }
  return defaultValue;
}

/**
 * Validate limit parameter
 */
export function validateLimit(value: unknown, defaultValue = 20, max = 100): number {
  if (typeof value === 'number' && value > 0) {
    return Math.min(value, max);
  }
  return defaultValue;
}

/**
 * Calculate text match score (0-1)
 */
export function calculateTextMatch(
  _text: string,
  query: string,
  fields: { name?: string; description?: string; tags?: string[] }
): number {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  let score = 0;
  let maxScore = 0;

  // Name match (highest weight)
  if (fields.name) {
    maxScore += 3;
    const nameLower = fields.name.toLowerCase();
    if (nameLower === queryLower) {
      score += 3; // Exact match
    } else if (nameLower.includes(queryLower)) {
      score += 2; // Contains query
    } else if (words.some((w) => nameLower.includes(w))) {
      score += 1; // Contains word
    }
  }

  // Description match
  if (fields.description) {
    maxScore += 2;
    const descLower = fields.description.toLowerCase();
    if (descLower.includes(queryLower)) {
      score += 2;
    } else if (words.some((w) => descLower.includes(w))) {
      score += 1;
    }
  }

  // Tags match
  if (fields.tags && fields.tags.length > 0) {
    maxScore += 1;
    const tagsLower = fields.tags.map((t) => t.toLowerCase());
    if (tagsLower.some((t) => t === queryLower || words.includes(t))) {
      score += 1;
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Calculate relevance score for a skill
 */
export function calculateRelevanceScore(
  skill: {
    name: string;
    description: string;
    tags?: string[];
    rating?: number;
    downloads?: number;
    updatedAt?: string;
  },
  query: string
): number {
  // Text relevance (0-40)
  const textRelevance =
    calculateTextMatch(query, query, {
      name: skill.name,
      description: skill.description,
      tags: skill.tags,
    }) * 40;

  // Rating score (0-25)
  const rating = skill.rating ?? 3;
  const ratingScore = (rating / 5) * 25;

  // Popularity score (0-20) - log scale
  const downloads = skill.downloads ?? 0;
  const popularityScore = Math.min(Math.log10(downloads + 1) / 4, 1) * 20;

  // Freshness score (0-15) - decay over 180 days
  let freshnessScore = 15;
  if (skill.updatedAt) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    freshnessScore = Math.max(0, 1 - daysSinceUpdate / 180) * 15;
  }

  return textRelevance + ratingScore + popularityScore + freshnessScore;
}
