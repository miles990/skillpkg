/**
 * export command - Export skills to various formats
 */
import {
  createExporter,
  createLocalStore,
  createGlobalStore,
} from 'skillpkg-core';
import type { ExportFormat, Skill } from 'skillpkg-core';
import { logger, colors, withSpinner } from '../ui/index.js';

interface ExportOptions {
  format?: string;
  output?: string;
  global?: boolean;
  overwrite?: boolean;
  all?: boolean;
}

/**
 * export command handler
 */
export async function exportCommand(
  skillName: string | undefined,
  options: ExportOptions
): Promise<void> {
  const exporter = createExporter();
  const store = options.global ? createGlobalStore() : createLocalStore();

  // Check if store is initialized
  if (!(await store.isInitialized())) {
    logger.error('No skills installed');
    logger.log(`Run ${colors.cyan('skillpkg install <skill>')} first`);
    process.exit(1);
  }

  logger.header('Export Skills');

  // Validate format
  const format = validateFormat(options.format || 'dir');
  if (!format) {
    logger.error(`Invalid format: ${options.format}`);
    logger.log('Valid formats: dir, zip, tarball, pack');
    process.exit(1);
  }

  // Get skills to export
  let skills: Skill[] = [];

  if (options.all || !skillName) {
    // Export all skills
    const skillsMeta = await store.listSkills();
    for (const meta of skillsMeta) {
      const skill = await store.getSkill(meta.name);
      if (skill) {
        skills.push(skill);
      }
    }
  } else {
    // Export specific skill
    const skill = await store.getSkill(skillName);
    if (!skill) {
      logger.error(`Skill ${colors.cyan(skillName)} not found`);
      process.exit(1);
    }
    skills.push(skill);
  }

  if (skills.length === 0) {
    logger.warn('No skills to export');
    return;
  }

  logger.log(`Exporting ${colors.cyan(String(skills.length))} skill(s) as ${colors.cyan(format)}`);
  logger.blank();

  const outputDir = options.output || process.cwd();
  let successCount = 0;
  let failCount = 0;

  for (const skill of skills) {
    const result = await withSpinner(
      `Exporting ${colors.cyan(skill.name)}`,
      () =>
        exporter.export(skill, {
          format,
          output: outputDir,
          overwrite: options.overwrite,
        }),
      {
        successText: `Exported ${colors.cyan(skill.name)}`,
        failText: `Failed to export ${skill.name}`,
      }
    );

    if (result.success) {
      successCount++;
      logger.log(`  ${colors.dim(result.outputPath)}`);
      if (result.size) {
        logger.log(`  ${colors.dim(`Size: ${formatSize(result.size)}`)}`);
      }
    } else {
      failCount++;
      logger.error(`  ${result.error}`);
    }
  }

  // Summary
  logger.blank();
  logger.log(
    `Summary: ${colors.green(String(successCount))} exported, ` +
      `${colors.red(String(failCount))} failed`
  );
  logger.blank();

  if (successCount > 0 && format === 'pack') {
    logger.log('Install with:');
    logger.item(`${colors.cyan('skillpkg install <file>.skillpkg')}`);
    logger.blank();
  }
}

/**
 * Validate and normalize export format
 */
function validateFormat(format: string): ExportFormat | null {
  const validFormats: ExportFormat[] = ['dir', 'zip', 'tarball', 'pack'];
  const normalized = format.toLowerCase() as ExportFormat;

  // Handle aliases
  if (format === 'tar.gz' || format === 'tgz') {
    return 'tarball';
  }

  if (validFormats.includes(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
