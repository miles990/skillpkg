/**
 * Table utilities with cli-table3
 */
import Table from 'cli-table3';
import { colors } from './logger.js';

/**
 * Table options
 */
export interface TableOptions {
  head: string[];
  colWidths?: number[];
}

/**
 * Create a styled table
 */
export function createTable(options: TableOptions): Table.Table {
  return new Table({
    head: options.head.map((h) => colors.cyan(h)),
    colWidths: options.colWidths,
    style: {
      head: [],
      border: [],
    },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
  });
}

/**
 * Print a table
 */
export function printTable(table: Table.Table): void {
  console.log(table.toString());
}
