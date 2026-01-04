/**
 * Adapters module - Platform synchronization
 */

// Types
export type {
  PlatformAdapter,
  DetectedPlatform,
  SyncOptions,
  SyncResult,
  SyncedItem,
  SkippedItem,
  SyncError,
} from './types.js';

// Base class
export { BaseAdapter } from './base.js';

// Platform adapters
export { ClaudeCodeAdapter } from './claude-code.js';
export { CodexAdapter } from './codex.js';
export { CopilotAdapter } from './copilot.js';
export { ClineAdapter } from './cline.js';

// Manager
export { AdapterManager, createAdapterManager } from './adapter-manager.js';
