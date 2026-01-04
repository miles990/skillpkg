/**
 * Doctor module types
 *
 * Types for diagnosing and repairing skillpkg state
 */

/**
 * Issue severity levels
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Issue types that can be detected
 */
export type IssueType =
  | 'orphan_state'      // Skill in state.json but not in registry/disk
  | 'orphan_registry'   // Skill in registry.json but not on disk
  | 'orphan_disk'       // Skill on disk but not in registry
  | 'orphan_dependency' // Dependency installed but no longer needed (via StateManager.getOrphanDependencies)
  | 'state_registry_mismatch'  // Version or source mismatch between state and registry
  | 'invalid_skill_name'       // Skill name contains path separators
  | 'missing_skillpkg_entry'   // Skill in state but not in skillpkg.json
  | 'dangling_dependency'      // Dependency reference to non-existent skill
  | 'sync_outdated';           // Synced files outdated

/**
 * Detected issue
 */
export interface Issue {
  type: IssueType;
  severity: IssueSeverity;
  skillName: string;
  message: string;
  suggestion: string;
  autoFixable: boolean;
}

/**
 * Diagnosis result
 */
export interface DiagnosisResult {
  healthy: boolean;
  issues: Issue[];
  stats: {
    stateCount: number;
    registryCount: number;
    diskCount: number;
    syncedCount: number;
  };
}

/**
 * Repair options
 */
export interface RepairOptions {
  /** Only fix auto-fixable issues */
  autoOnly?: boolean;
  /** Dry run - don't actually make changes */
  dryRun?: boolean;
  /** Remove orphaned entries from state/registry */
  removeOrphans?: boolean;
  /** Re-sync skills to platforms */
  resync?: boolean;
}

/**
 * Repair action
 */
export interface RepairAction {
  type: 'remove_state' | 'remove_registry' | 'add_registry' | 'update_state' | 'resync';
  skillName: string;
  description: string;
}

/**
 * Repair result
 */
export interface RepairResult {
  success: boolean;
  actions: RepairAction[];
  errors: string[];
  issuesFixed: number;
  issuesRemaining: number;
}
