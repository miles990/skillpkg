/**
 * Exporter types
 */

/**
 * Export format
 */
export type ExportFormat = 'dir' | 'zip' | 'tarball' | 'pack';

/**
 * Export options
 */
export interface ExportOptions {
  /** Output path (directory for 'dir', file path for others) */
  output?: string;
  /** Export format */
  format?: ExportFormat;
  /** Overwrite existing files */
  overwrite?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  skillName: string;
  format: ExportFormat;
  outputPath: string;
  size?: number;
  error?: string;
}

/**
 * Batch export result
 */
export interface BatchExportResult {
  exported: ExportResult[];
  failed: ExportResult[];
  total: number;
}
