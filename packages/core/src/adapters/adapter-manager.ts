/**
 * Adapter Manager
 *
 * Manages platform adapters and sync operations
 */
import type { Skill } from '../types.js';
import type {
  PlatformAdapter,
  DetectedPlatform,
  SyncOptions,
  SyncResult,
} from './types.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { CodexAdapter } from './codex.js';
import { CopilotAdapter } from './copilot.js';
import { ClineAdapter } from './cline.js';

/**
 * Adapter Manager class
 */
export class AdapterManager {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor() {
    // Register built-in adapters
    this.registerAdapter(new ClaudeCodeAdapter());
    this.registerAdapter(new CodexAdapter());
    this.registerAdapter(new CopilotAdapter());
    this.registerAdapter(new ClineAdapter());
  }

  /**
   * Register a platform adapter
   */
  registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Get an adapter by name
   */
  getAdapter(name: string): PlatformAdapter | null {
    return this.adapters.get(name) || null;
  }

  /**
   * List all registered adapters
   */
  listAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Detect which platforms are present in a project
   */
  async detectPlatforms(projectPath: string): Promise<DetectedPlatform[]> {
    const results: DetectedPlatform[] = [];

    for (const adapter of this.adapters.values()) {
      const detected = await adapter.detect(projectPath);
      results.push({
        name: adapter.name,
        displayName: adapter.displayName,
        detected,
        path: detected ? adapter.getOutputPath('', projectPath) : '',
      });
    }

    return results;
  }

  /**
   * Sync skills to all or specified platforms
   */
  async sync(skills: Skill[], options: SyncOptions = {}): Promise<SyncResult> {
    const projectPath = options.projectPath || process.cwd();
    const targetPlatforms = options.platforms;
    const dryRun = options.dryRun || false;

    const result: SyncResult = {
      success: true,
      synced: [],
      skipped: [],
      errors: [],
    };

    // Get adapters to sync to
    let adaptersToUse: PlatformAdapter[];
    if (targetPlatforms?.length) {
      adaptersToUse = targetPlatforms
        .map((name) => this.adapters.get(name))
        .filter((a): a is PlatformAdapter => a !== undefined);
    } else {
      adaptersToUse = this.listAdapters();
    }

    // Detect which platforms are present
    const detectedPlatforms = await this.detectPlatforms(projectPath);
    const presentPlatforms = new Set(
      detectedPlatforms.filter((p) => p.detected).map((p) => p.name)
    );

    // Sync each skill to each platform
    for (const skill of skills) {
      for (const adapter of adaptersToUse) {
        // Check if platform is present
        if (!presentPlatforms.has(adapter.name)) {
          result.skipped.push({
            skill: skill.name,
            platform: adapter.name,
            reason: 'Platform not detected',
          });
          continue;
        }

        // Sync
        try {
          if (!dryRun) {
            await adapter.sync(skill, projectPath);
          }

          result.synced.push({
            skill: skill.name,
            platform: adapter.name,
            path: adapter.getOutputPath(skill.name, projectPath),
          });
        } catch (error) {
          result.success = false;
          result.errors.push({
            skill: skill.name,
            platform: adapter.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  /**
   * Sync skills to a specific platform
   */
  async syncToPlatform(
    platform: string,
    skills: Skill[],
    projectPath: string = process.cwd()
  ): Promise<SyncResult> {
    return this.sync(skills, { projectPath, platforms: [platform] });
  }

  /**
   * Remove a skill from all platforms
   */
  async removeFromAllPlatforms(
    skillName: string,
    projectPath: string = process.cwd()
  ): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.remove(skillName, projectPath);
      } catch {
        // Ignore errors during removal
      }
    }
  }

  /**
   * Remove a skill from a specific platform
   */
  async removeFromPlatform(
    skillName: string,
    platform: string,
    projectPath: string = process.cwd()
  ): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (adapter) {
      await adapter.remove(skillName, projectPath);
    }
  }
}

/**
 * Create a new AdapterManager instance
 */
export function createAdapterManager(): AdapterManager {
  return new AdapterManager();
}
