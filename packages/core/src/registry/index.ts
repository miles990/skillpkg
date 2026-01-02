/**
 * Registry module - public API
 */

// Types
export type {
  SearchOptions,
  SearchResult,
  SearchResultItem,
  SkillInfo,
  VersionInfo,
  PublishOptions,
  PublishResult,
} from './types.js';
export { RegistryError } from './types.js';

// Client
export {
  RegistryClient,
  createRegistryClient,
  DEFAULT_REGISTRY_URL,
} from './client.js';
export type { ClientOptions } from './client.js';

// Auth
export {
  getToken,
  setToken,
  removeToken,
  listTokens,
  isAuthenticated,
  getUsername,
} from './auth.js';
export type { AuthToken } from './auth.js';
