/**
 * Logger utilities with chalk colors
 */
import chalk from 'chalk';

/**
 * Check if colors should be disabled
 */
const noColor = process.env.NO_COLOR !== undefined || process.env.TERM === 'dumb';

/**
 * Conditionally apply chalk styling
 */
const c = noColor
  ? {
      green: (s: string) => s,
      red: (s: string) => s,
      yellow: (s: string) => s,
      blue: (s: string) => s,
      cyan: (s: string) => s,
      gray: (s: string) => s,
      bold: (s: string) => s,
      dim: (s: string) => s,
    }
  : chalk;

/**
 * Logger object with various log levels
 */
export const logger = {
  /** Log info message (blue) */
  info: (message: string) => {
    console.log(c.blue('ℹ'), message);
  },

  /** Log success message (green) */
  success: (message: string) => {
    console.log(c.green('✓'), message);
  },

  /** Log warning message (yellow) */
  warn: (message: string) => {
    console.log(c.yellow('⚠'), message);
  },

  /** Log error message (red) */
  error: (message: string) => {
    console.error(c.red('✖'), message);
  },

  /** Log debug message (gray) */
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(c.gray('⋯'), c.gray(message));
    }
  },

  /** Log plain message */
  log: (message: string) => {
    console.log(message);
  },

  /** Log a blank line */
  blank: () => {
    console.log();
  },

  /** Log a header */
  header: (title: string) => {
    console.log();
    console.log(c.bold(title));
    console.log(c.dim('─'.repeat(title.length)));
  },

  /** Log key-value pair */
  pair: (key: string, value: string) => {
    console.log(`  ${c.dim(key + ':')} ${value}`);
  },

  /** Log a list item */
  item: (text: string) => {
    console.log(`  ${c.dim('•')} ${text}`);
  },
};

/**
 * Chalk colors for external use
 */
export { c as colors };
