/**
 * import command - Import skills from platform formats
 */
import {
  createImporter,
  createLocalStore,
  createGlobalStore,
} from 'skillpkg-core';
import type { DetectedFile, ImportResult } from 'skillpkg-core';
import { logger, colors, withSpinner, createTable } from '../ui/index.js';

interface ImportOptions {
  from?: string;
  global?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
}

/**
 * import command handler
 */
export async function importCommand(
  path: string | undefined,
  options: ImportOptions
): Promise<void> {
  const importer = createImporter();
  const store = options.global ? createGlobalStore() : createLocalStore();

  // Determine source path
  const sourcePath = path || options.from || process.cwd();

  logger.header('Import Skills');

  // Detect importable files
  const detected = await withSpinner(
    `Scanning ${colors.cyan(sourcePath)}`,
    () => importer.detect(sourcePath),
    {
      successText: 'Scan complete',
      failText: 'Scan failed',
    }
  );

  if (detected.length === 0) {
    logger.blank();
    logger.warn('No importable skill files found');
    logger.blank();
    logger.log('Supported formats:');
    logger.item(`${colors.cyan('Claude Code')}: .claude/skills/*/SKILL.md`);
    logger.item(`${colors.cyan('Codex')}: .codex/agents/*.md`);
    logger.item(`${colors.cyan('Copilot')}: .github/copilot-instructions.md`);
    logger.item(`${colors.cyan('Cline')}: .cline/rules/*.md`);
    logger.blank();
    return;
  }

  // Show detected files
  logger.blank();
  logger.log(`Found ${colors.cyan(String(detected.length))} importable file(s):`);
  logger.blank();

  showDetectedTable(detected);

  if (options.dryRun) {
    logger.blank();
    logger.warn('Dry run mode - no changes will be made');
    logger.blank();
    return;
  }

  logger.blank();

  // Import each file
  const results: ImportResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const file of detected) {
    const result = await importer.importFile(file.path);
    results.push(result);

    if (result.success && result.skill) {
      // Save to store
      try {
        // Initialize store if needed
        if (!(await store.isInitialized())) {
          await store.init();
        }

        // Check if skill already exists
        if (await store.hasSkill(result.skill.name)) {
          if (options.overwrite) {
            await store.removeSkill(result.skill.name);
          } else {
            logger.warn(
              `${colors.cyan(result.skill.name)} already exists (use --overwrite to replace)`
            );
            failCount++;
            continue;
          }
        }

        // Add skill to store
        await store.addSkill(result.skill);
        logger.success(
          `Imported ${colors.cyan(result.skill.name)}@${result.skill.version} from ${file.displayName}`
        );
        successCount++;
      } catch (error) {
        logger.error(
          `Failed to save ${result.skill.name}: ${error instanceof Error ? error.message : String(error)}`
        );
        failCount++;
      }
    } else {
      logger.error(`Failed to import ${file.path}: ${result.error}`);
      failCount++;
    }
  }

  // Summary
  logger.blank();
  logger.log(
    `Summary: ${colors.green(String(successCount))} imported, ` +
      `${colors.red(String(failCount))} failed`
  );
  logger.blank();

  if (successCount > 0) {
    logger.log('Next steps:');
    logger.item(`Run ${colors.cyan('skillpkg list')} to see imported skills`);
    logger.item(`Run ${colors.cyan('skillpkg sync')} to sync to platforms`);
    logger.blank();
  }
}

/**
 * Show detected files in a table
 */
function showDetectedTable(detected: DetectedFile[]): void {
  const table = createTable({
    head: ['File', 'Platform'],
  });

  for (const file of detected) {
    // Shorten path for display
    const displayPath = shortenPath(file.path, 50);
    table.push([displayPath, file.displayName]);
  }

  logger.log(table.toString());
}

/**
 * Shorten a path for display
 */
function shortenPath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }

  const parts = path.split('/');
  if (parts.length <= 3) {
    return path;
  }

  // Keep first and last parts
  const first = parts[0] || '';
  const last = parts.slice(-2).join('/');

  return `${first}/.../${last}`;
}
