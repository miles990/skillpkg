/**
 * YAML parser for skill.yaml files
 */
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import type { Skill } from '../types.js';
import { validate, type ValidationResult } from './validator.js';

/**
 * Parse error with line/column information
 */
export interface ParseError {
  /** Error message */
  message: string;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Error code */
  code: 'YAML_SYNTAX' | 'VALIDATION' | 'UNKNOWN';
}

/**
 * Parse result
 */
export interface ParseResult<T> {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed data (if successful) */
  data?: T;
  /** Parse errors (if failed) */
  errors?: ParseError[];
  /** Validation warnings (even if successful) */
  warnings?: string[];
}

/**
 * Parse options
 */
export interface ParseOptions {
  /** Whether to validate after parsing (default: true) */
  validate?: boolean;
  /** Whether to include warnings in result (default: true) */
  includeWarnings?: boolean;
}

/**
 * Parse a skill.yaml string into a Skill object
 *
 * @param content - The YAML content to parse
 * @param options - Parse options
 * @returns ParseResult with the parsed Skill or errors
 */
export function parse(content: string, options: ParseOptions = {}): ParseResult<Skill> {
  const { validate: shouldValidate = true, includeWarnings = true } = options;

  try {
    // Parse YAML
    const data = parseYaml(content, {
      prettyErrors: true,
    });

    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
      return {
        success: false,
        errors: [
          {
            message: 'skill.yaml must contain an object',
            code: 'VALIDATION',
          },
        ],
      };
    }

    // Validate if requested
    if (shouldValidate) {
      const validationResult = validate(data);

      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors.map((e) => ({
            message: `${e.path}: ${e.message}${e.expected ? ` (expected: ${e.expected})` : ''}`,
            code: 'VALIDATION' as const,
          })),
        };
      }

      // Return with warnings
      const warnings = includeWarnings
        ? validationResult.warnings.map((w) => `${w.path}: ${w.message}`)
        : undefined;

      return {
        success: true,
        data: data as Skill,
        warnings: warnings?.length ? warnings : undefined,
      };
    }

    return {
      success: true,
      data: data as Skill,
    };
  } catch (error) {
    // Handle YAML parse errors
    if (error instanceof YAMLParseError) {
      return {
        success: false,
        errors: [
          {
            message: error.message,
            line: error.linePos?.[0]?.line,
            column: error.linePos?.[0]?.col,
            code: 'YAML_SYNTAX',
          },
        ],
      };
    }

    // Handle unknown errors
    return {
      success: false,
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN',
        },
      ],
    };
  }
}

/**
 * Stringify a Skill object to YAML
 *
 * @param skill - The Skill object to stringify
 * @returns YAML string
 */
export function stringify(skill: Skill): string {
  return stringifyYaml(skill, {
    indent: 2,
    lineWidth: 0, // Don't wrap lines
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });
}

/**
 * Parse and validate, returning both results
 *
 * @param content - The YAML content to parse
 * @returns Object with parsed skill and validation result
 */
export function parseAndValidate(content: string): {
  skill: Skill | null;
  validation: ValidationResult;
  parseErrors?: ParseError[];
} {
  const parseResult = parse(content, { validate: false });

  if (!parseResult.success || !parseResult.data) {
    return {
      skill: null,
      validation: { valid: false, errors: [], warnings: [] },
      parseErrors: parseResult.errors,
    };
  }

  const validation = validate(parseResult.data);

  return {
    skill: validation.valid ? parseResult.data : null,
    validation,
  };
}
