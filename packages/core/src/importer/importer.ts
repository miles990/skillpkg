/**
 * Importer - Import skills from various platform formats
 *
 * Uses platform adapters to detect and import skills
 */
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { PlatformAdapter } from '../adapters/types.js';
import { createAdapterManager } from '../adapters/adapter-manager.js';
import type {
  ImportResult,
  BatchImportResult,
  ImportOptions,
  DetectedFile,
} from './types.js';

/**
 * Importer class
 */
export class Importer {
  private adapters: PlatformAdapter[];

  constructor() {
    const manager = createAdapterManager();
    this.adapters = manager.listAdapters();
  }

  /**
   * Detect importable files in a path
   */
  async detect(path: string): Promise<DetectedFile[]> {
    const detected: DetectedFile[] = [];
    const stats = await stat(path).catch(() => null);

    if (!stats) {
      return detected;
    }

    if (stats.isFile()) {
      // Single file - check each adapter
      for (const adapter of this.adapters) {
        if (await adapter.canImport(path)) {
          detected.push({
            path,
            platform: adapter.name,
            displayName: adapter.displayName,
          });
          break; // First match wins
        }
      }
    } else if (stats.isDirectory()) {
      // Directory - scan for importable files
      await this.scanDirectory(path, detected);
    }

    return detected;
  }

  /**
   * Scan directory recursively for importable files
   */
  private async scanDirectory(
    dirPath: string,
    detected: DetectedFile[],
    depth: number = 0
  ): Promise<void> {
    // Limit recursion depth
    if (depth > 5) return;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isFile()) {
          // Check if any adapter can import this file
          for (const adapter of this.adapters) {
            if (await adapter.canImport(fullPath)) {
              detected.push({
                path: fullPath,
                platform: adapter.name,
                displayName: adapter.displayName,
              });
              break;
            }
          }
        } else if (entry.isDirectory()) {
          // Skip common non-skill directories
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }

          // Recurse into subdirectory
          await this.scanDirectory(fullPath, detected, depth + 1);
        }
      }
    } catch {
      // Ignore permission errors, etc.
    }
  }

  /**
   * Check if a directory should be skipped during scanning
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.svn',
      'dist',
      'build',
      'coverage',
      '__pycache__',
      '.venv',
      'venv',
    ];
    return skipDirs.includes(name);
  }

  /**
   * Import a single file
   */
  async importFile(
    path: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    // Find adapter that can import this file
    let targetAdapter: PlatformAdapter | null = null;

    if (options.platform) {
      // Use specified platform
      targetAdapter =
        this.adapters.find((a) => a.name === options.platform) || null;
      if (targetAdapter && !(await targetAdapter.canImport(path))) {
        return {
          path,
          success: false,
          error: `File is not a valid ${targetAdapter.displayName} format`,
        };
      }
    } else {
      // Auto-detect platform
      for (const adapter of this.adapters) {
        if (await adapter.canImport(path)) {
          targetAdapter = adapter;
          break;
        }
      }
    }

    if (!targetAdapter) {
      return {
        path,
        success: false,
        error: 'No compatible platform adapter found',
      };
    }

    try {
      const skill = await targetAdapter.import(path);
      return {
        path,
        success: true,
        skill,
        platform: targetAdapter.name,
      };
    } catch (error) {
      return {
        path,
        success: false,
        platform: targetAdapter.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Import multiple files (batch import)
   */
  async importBatch(
    paths: string[],
    options: ImportOptions = {}
  ): Promise<BatchImportResult> {
    const result: BatchImportResult = {
      imported: [],
      failed: [],
      skipped: [],
      total: paths.length,
    };

    for (const path of paths) {
      const importResult = await this.importFile(path, options);

      if (importResult.success) {
        result.imported.push(importResult);
      } else {
        result.failed.push(importResult);
      }
    }

    return result;
  }

  /**
   * Import from a path (file or directory)
   */
  async importFrom(
    path: string,
    options: ImportOptions = {}
  ): Promise<BatchImportResult> {
    // First detect importable files
    const detected = await this.detect(path);

    if (detected.length === 0) {
      return {
        imported: [],
        failed: [],
        skipped: [
          {
            path,
            success: false,
            error: 'No importable files found',
          },
        ],
        total: 0,
      };
    }

    // Import all detected files
    return this.importBatch(
      detected.map((d) => d.path),
      options
    );
  }
}

/**
 * Create a new Importer instance
 */
export function createImporter(): Importer {
  return new Importer();
}
