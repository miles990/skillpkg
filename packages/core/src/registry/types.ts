/**
 * Registry client types
 */

/**
 * Search options
 */
export interface SearchOptions {
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'downloads' | 'updated' | 'name';
  order?: 'asc' | 'desc';
}

/**
 * Search result
 */
export interface SearchResult {
  query: string;
  total: number;
  page: number;
  limit: number;
  results: SearchResultItem[];
}

/**
 * Individual search result item
 */
export interface SearchResultItem {
  name: string;
  version: string;
  description: string;
  author?: string;
  downloads: number;
  updatedAt: string;
  keywords?: string[];
}

/**
 * Skill info from registry
 */
export interface SkillInfo {
  name: string;
  description: string;
  version: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  repository?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  downloads: {
    total: number;
    weekly: number;
    monthly: number;
  };
  versions: VersionInfo[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Version info
 */
export interface VersionInfo {
  version: string;
  publishedAt: string;
  downloads: number;
  deprecated?: boolean;
  deprecationMessage?: string;
}

/**
 * Publish options
 */
export interface PublishOptions {
  access?: 'public' | 'restricted';
  tag?: string;
}

/**
 * Publish result
 */
export interface PublishResult {
  name: string;
  version: string;
  publishedAt: string;
  url: string;
}

// Note: RegistryConfig is defined in ../types.ts

/**
 * Registry error
 */
export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}
