/**
 * Exporter - Export skills to various formats
 */
import { mkdir, writeFile, stat } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { pack as tarPack } from 'tar-stream';
import matter from 'gray-matter';
import type { Skill } from '../types.js';
import type {
  ExportOptions,
  ExportResult,
  BatchExportResult,
} from './types.js';

/**
 * Exporter class
 */
export class Exporter {
  /**
   * Convert a Skill to SKILL.md format (Markdown with YAML frontmatter)
   */
  private skillToMarkdown(skill: Skill): string {
    const frontmatter = {
      name: skill.name,
      version: skill.version,
      description: skill.description,
    };
    const content = skill.instructions || '';
    return matter.stringify(content, frontmatter);
  }
  /**
   * Export a skill to the specified format
   */
  async export(
    skill: Skill,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const format = options.format || 'dir';
    const outputBase = options.output || process.cwd();

    try {
      switch (format) {
        case 'dir':
          return await this.exportAsDir(skill, outputBase, options);
        case 'zip':
          return await this.exportAsZip(skill, outputBase, options);
        case 'tarball':
          return await this.exportAsTarball(skill, outputBase, options);
        case 'pack':
          return await this.exportAsPack(skill, outputBase, options);
        default:
          return {
            success: false,
            skillName: skill.name,
            format,
            outputPath: '',
            error: `Unknown format: ${format}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        skillName: skill.name,
        format,
        outputPath: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Export multiple skills
   */
  async exportBatch(
    skills: Skill[],
    options: ExportOptions = {}
  ): Promise<BatchExportResult> {
    const result: BatchExportResult = {
      exported: [],
      failed: [],
      total: skills.length,
    };

    for (const skill of skills) {
      const exportResult = await this.export(skill, options);

      if (exportResult.success) {
        result.exported.push(exportResult);
      } else {
        result.failed.push(exportResult);
      }
    }

    return result;
  }

  /**
   * Export as directory with SKILL.md
   */
  private async exportAsDir(
    skill: Skill,
    outputBase: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const dirPath = join(outputBase, skill.name);
    const mdPath = join(dirPath, 'SKILL.md');

    // Check if directory exists
    const exists = await this.pathExists(dirPath);
    if (exists && !options.overwrite) {
      return {
        success: false,
        skillName: skill.name,
        format: 'dir',
        outputPath: dirPath,
        error: 'Directory already exists',
      };
    }

    // Create directory
    await mkdir(dirPath, { recursive: true });

    // Write SKILL.md
    const mdContent = this.skillToMarkdown(skill);
    await writeFile(mdPath, mdContent, 'utf-8');

    return {
      success: true,
      skillName: skill.name,
      format: 'dir',
      outputPath: dirPath,
    };
  }

  /**
   * Export as zip file
   * Uses a simple implementation without external dependencies
   */
  private async exportAsZip(
    skill: Skill,
    outputBase: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const zipPath = join(outputBase, `${skill.name}.zip`);

    // Check if file exists
    const exists = await this.pathExists(zipPath);
    if (exists && !options.overwrite) {
      return {
        success: false,
        skillName: skill.name,
        format: 'zip',
        outputPath: zipPath,
        error: 'File already exists',
      };
    }

    // Create a simple zip file using store method (no compression)
    // This is a minimal implementation without archiver dependency
    const mdContent = this.skillToMarkdown(skill);
    const zipBuffer = this.createSimpleZip(skill.name, mdContent);

    await writeFile(zipPath, zipBuffer);

    const stats = await stat(zipPath);

    return {
      success: true,
      skillName: skill.name,
      format: 'zip',
      outputPath: zipPath,
      size: stats.size,
    };
  }

  /**
   * Export as tarball (.tar.gz)
   */
  private async exportAsTarball(
    skill: Skill,
    outputBase: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const tarPath = join(outputBase, `${skill.name}.tar.gz`);

    // Check if file exists
    const exists = await this.pathExists(tarPath);
    if (exists && !options.overwrite) {
      return {
        success: false,
        skillName: skill.name,
        format: 'tarball',
        outputPath: tarPath,
        error: 'File already exists',
      };
    }

    // Create tarball
    const mdContent = this.skillToMarkdown(skill);
    const pack = tarPack();

    // Add SKILL.md to archive
    pack.entry({ name: `${skill.name}/SKILL.md` }, mdContent);
    pack.finalize();

    // Gzip and write to file
    const gzip = createGzip();
    const output = createWriteStream(tarPath);

    await pipeline(pack, gzip, output);

    const stats = await stat(tarPath);

    return {
      success: true,
      skillName: skill.name,
      format: 'tarball',
      outputPath: tarPath,
      size: stats.size,
    };
  }

  /**
   * Export as .skillpkg pack (same as tarball but with .skillpkg extension)
   */
  private async exportAsPack(
    skill: Skill,
    outputBase: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const packPath = join(outputBase, `${skill.name}.skillpkg`);

    // Check if file exists
    const exists = await this.pathExists(packPath);
    if (exists && !options.overwrite) {
      return {
        success: false,
        skillName: skill.name,
        format: 'pack',
        outputPath: packPath,
        error: 'File already exists',
      };
    }

    // Create tarball (same as tarball format)
    const mdContent = this.skillToMarkdown(skill);
    const pack = tarPack();

    pack.entry({ name: `${skill.name}/SKILL.md` }, mdContent);
    pack.finalize();

    const gzip = createGzip();
    const output = createWriteStream(packPath);

    await pipeline(pack, gzip, output);

    const stats = await stat(packPath);

    return {
      success: true,
      skillName: skill.name,
      format: 'pack',
      outputPath: packPath,
      size: stats.size,
    };
  }

  /**
   * Create a simple zip file (store method, no compression)
   * Minimal implementation without external dependencies
   */
  private createSimpleZip(skillName: string, content: string): Buffer {
    const fileName = `${skillName}/SKILL.md`;
    const fileNameBuffer = Buffer.from(fileName, 'utf-8');
    const contentBuffer = Buffer.from(content, 'utf-8');

    // Local file header
    const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Version needed
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(0, 8); // Compression method (store)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(this.crc32(contentBuffer), 14); // CRC-32
    localHeader.writeUInt32LE(contentBuffer.length, 18); // Compressed size
    localHeader.writeUInt32LE(contentBuffer.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuffer.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length
    fileNameBuffer.copy(localHeader, 30);

    // Central directory header
    const centralHeader = Buffer.alloc(46 + fileNameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0, 8); // Flags
    centralHeader.writeUInt16LE(0, 10); // Compression method
    centralHeader.writeUInt16LE(0, 12); // Mod time
    centralHeader.writeUInt16LE(0, 14); // Mod date
    centralHeader.writeUInt32LE(this.crc32(contentBuffer), 16); // CRC-32
    centralHeader.writeUInt32LE(contentBuffer.length, 20); // Compressed size
    centralHeader.writeUInt32LE(contentBuffer.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28); // File name length
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number
    centralHeader.writeUInt16LE(0, 36); // Internal attributes
    centralHeader.writeUInt32LE(0, 38); // External attributes
    centralHeader.writeUInt32LE(0, 42); // Offset of local header
    fileNameBuffer.copy(centralHeader, 46);

    // End of central directory
    const endOfCentral = Buffer.alloc(22);
    const centralOffset = localHeader.length + contentBuffer.length;
    endOfCentral.writeUInt32LE(0x06054b50, 0); // Signature
    endOfCentral.writeUInt16LE(0, 4); // Disk number
    endOfCentral.writeUInt16LE(0, 6); // Central dir disk
    endOfCentral.writeUInt16LE(1, 8); // Entries on this disk
    endOfCentral.writeUInt16LE(1, 10); // Total entries
    endOfCentral.writeUInt32LE(centralHeader.length, 12); // Central dir size
    endOfCentral.writeUInt32LE(centralOffset, 16); // Central dir offset
    endOfCentral.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([
      localHeader,
      contentBuffer,
      centralHeader,
      endOfCentral,
    ]);
  }

  /**
   * Calculate CRC-32 checksum
   */
  private crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    const table = this.getCrc32Table();

    for (const byte of buffer) {
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get CRC-32 lookup table
   */
  private getCrc32Table(): number[] {
    const table: number[] = [];

    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
      table[i] = crc;
    }

    return table;
  }

  /**
   * Check if a path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Exporter instance
 */
export function createExporter(): Exporter {
  return new Exporter();
}
