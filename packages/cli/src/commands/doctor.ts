/**
 * doctor command - Diagnose and repair skillpkg state
 *
 * Detects inconsistencies between state.json, registry.json, and disk files,
 * and provides options to repair them.
 */
import {
  createDoctor,
  createStateManager,
  createConfigManager,
  createLocalStore,
  type Issue,
} from 'skillpkg-core';
import { logger, colors } from '../ui/index.js';

interface DoctorOptions {
  fix?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

/**
 * doctor command handler
 */
export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const cwd = process.cwd();

  const stateManager = createStateManager();
  const configManager = createConfigManager();
  const storeManager = createLocalStore();

  // Check if store is initialized
  if (!(await storeManager.isInitialized())) {
    if (options.json) {
      console.log(JSON.stringify({ healthy: true, issues: [], message: 'No skillpkg store found' }));
    } else {
      logger.info('No skillpkg store found');
      logger.log(`Run ${colors.cyan('skillpkg install <skill>')} to install skills`);
    }
    return;
  }

  const doctor = createDoctor(stateManager, configManager, storeManager);

  // Run diagnosis
  const diagnosis = await doctor.diagnose(cwd);

  // JSON output mode
  if (options.json) {
    console.log(JSON.stringify(diagnosis, null, 2));
    if (options.fix && !options.dryRun) {
      const repairResult = await doctor.repair(cwd, {
        removeOrphans: true,
        dryRun: options.dryRun,
      });
      console.log(JSON.stringify({ diagnosis, repair: repairResult }, null, 2));
    }
    return;
  }

  // Human-readable output
  logger.header('skillpkg Doctor');
  logger.blank();

  // Stats
  logger.log(colors.bold('Status'));
  logger.item(`State entries: ${colors.cyan(String(diagnosis.stats.stateCount))}`);
  logger.item(`Registry entries: ${colors.cyan(String(diagnosis.stats.registryCount))}`);
  logger.item(`Disk skills: ${colors.cyan(String(diagnosis.stats.diskCount))}`);
  logger.item(`Synced: ${colors.cyan(String(diagnosis.stats.syncedCount))}`);
  logger.blank();

  // Health status
  if (diagnosis.healthy) {
    logger.success('✓ Everything looks healthy!');
    logger.blank();
    return;
  }

  // Show issues
  logger.log(colors.bold('Issues Found'));
  logger.blank();

  // Group issues by severity
  const errors = diagnosis.issues.filter(i => i.severity === 'error');
  const warnings = diagnosis.issues.filter(i => i.severity === 'warning');
  const infos = diagnosis.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    logger.log(colors.red(`✗ ${errors.length} Error(s)`));
    for (const issue of errors) {
      printIssue(issue);
    }
    logger.blank();
  }

  if (warnings.length > 0) {
    logger.log(colors.yellow(`⚠ ${warnings.length} Warning(s)`));
    for (const issue of warnings) {
      printIssue(issue);
    }
    logger.blank();
  }

  if (infos.length > 0) {
    logger.log(colors.dim(`ℹ ${infos.length} Info`));
    for (const issue of infos) {
      printIssue(issue);
    }
    logger.blank();
  }

  // Offer repair
  const fixableCount = diagnosis.issues.filter(i => i.autoFixable).length;

  if (!options.fix) {
    if (fixableCount > 0) {
      logger.log(colors.dim('─'.repeat(50)));
      logger.log(`${colors.cyan(String(fixableCount))} issue(s) can be auto-fixed.`);
      logger.log(`Run ${colors.cyan('skillpkg doctor --fix')} to repair.`);
      logger.log(`Run ${colors.cyan('skillpkg doctor --fix --dry-run')} to preview changes.`);
    }
    logger.blank();
    process.exit(errors.length > 0 ? 1 : 0);
    return;
  }

  // Perform repair
  logger.log(colors.bold('Repairing...'));
  logger.blank();

  const repairResult = await doctor.repair(cwd, {
    removeOrphans: true,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    logger.warn('Dry run - no changes made');
    logger.blank();
  }

  // Show actions
  if (repairResult.actions.length > 0) {
    for (const action of repairResult.actions) {
      const icon = options.dryRun ? colors.dim('○') : colors.green('✓');
      logger.log(`  ${icon} ${action.description}`);
    }
    logger.blank();
  }

  // Show errors
  if (repairResult.errors.length > 0) {
    logger.error('Some repairs failed:');
    for (const error of repairResult.errors) {
      logger.log(`  ${colors.red('×')} ${error}`);
    }
    logger.blank();
  }

  // Summary
  if (options.dryRun) {
    logger.log(
      `Would fix: ${colors.green(String(repairResult.actions.length))} issue(s)`
    );
  } else {
    logger.log(
      `Fixed: ${colors.green(String(repairResult.issuesFixed))}, ` +
      `Remaining: ${colors.yellow(String(repairResult.issuesRemaining))}`
    );
  }
  logger.blank();

  if (!repairResult.success) {
    process.exit(1);
  }
}

/**
 * Print a single issue
 */
function printIssue(issue: Issue): void {
  const icon = issue.severity === 'error'
    ? colors.red('×')
    : issue.severity === 'warning'
    ? colors.yellow('!')
    : colors.dim('•');

  const fixable = issue.autoFixable ? colors.dim(' [auto-fixable]') : '';

  logger.log(`  ${icon} ${colors.cyan(issue.skillName)}${fixable}`);
  logger.log(`    ${issue.message}`);
  logger.log(`    ${colors.dim(`→ ${issue.suggestion}`)}`);
}
