/**
 * Skill validation using JSON Schema
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { skillSchema, fieldDescriptions } from './schema.js';
import type { Skill } from '../types.js';

/**
 * Validation error with detailed information
 */
export interface ValidationError {
  /** JSON path to the error (e.g., "/name") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Expected value/type */
  expected?: string;
  /** Actual value received */
  actual?: unknown;
}

/**
 * Validation warning (non-critical issues)
 */
export interface ValidationWarning {
  /** JSON path to the warning */
  path: string;
  /** Warning message */
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the skill is valid */
  valid: boolean;
  /** Validation errors (if any) */
  errors: ValidationError[];
  /** Validation warnings (non-critical) */
  warnings: ValidationWarning[];
}

// Create Ajv instance with formats
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});
addFormats(ajv);

// Compile the schema
const validateSkill = ajv.compile(skillSchema);

/**
 * Validate a skill object against the schema
 */
export function validate(skill: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Run JSON Schema validation
  const isValid = validateSkill(skill);

  if (!isValid && validateSkill.errors) {
    for (const error of validateSkill.errors) {
      const path = error.instancePath || '/';
      const fieldName = path.split('/').pop() || 'root';
      const description = fieldDescriptions[fieldName] || '';

      let message = error.message || 'Validation error';
      let expected: string | undefined;

      // Enhance error messages
      switch (error.keyword) {
        case 'required':
          message = `Missing required field: ${error.params.missingProperty}`;
          expected = description || undefined;
          break;
        case 'pattern':
          message = `Invalid format for "${fieldName}"`;
          expected = getPatternDescription(fieldName);
          break;
        case 'enum':
          message = `Invalid value for "${fieldName}"`;
          expected = `One of: ${(error.params.allowedValues as string[]).join(', ')}`;
          break;
        case 'type':
          message = `Invalid type for "${fieldName}"`;
          expected = error.params.type as string;
          break;
        case 'minLength':
          message = `"${fieldName}" is too short`;
          expected = `At least ${error.params.limit} characters`;
          break;
        case 'maxLength':
          message = `"${fieldName}" is too long`;
          expected = `At most ${error.params.limit} characters`;
          break;
        case 'format':
          message = `Invalid ${error.params.format} format for "${fieldName}"`;
          break;
        case 'additionalProperties':
          message = `Unknown field: ${error.params.additionalProperty}`;
          break;
      }

      errors.push({
        path,
        message,
        expected,
        actual: error.data,
      });
    }
  }

  // Add warnings for best practices (even if valid)
  if (typeof skill === 'object' && skill !== null) {
    const s = skill as Partial<Skill>;

    // Warn if no triggers defined
    if (!s.triggers || s.triggers.length === 0) {
      warnings.push({
        path: '/triggers',
        message: 'No trigger words defined. Consider adding triggers for easier activation.',
      });
    }

    // Warn if no capabilities defined
    if (!s.capabilities || s.capabilities.length === 0) {
      warnings.push({
        path: '/capabilities',
        message: 'No capabilities declared. Consider declaring required capabilities.',
      });
    }

    // Warn if description is too short
    if (s.description && s.description.length < 20) {
      warnings.push({
        path: '/description',
        message: 'Description is very short. Consider adding more detail.',
      });
    }

    // Warn if no author
    if (!s.author) {
      warnings.push({
        path: '/author',
        message: 'No author specified. Consider adding author information.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get human-readable pattern description
 */
function getPatternDescription(fieldName: string): string {
  switch (fieldName) {
    case 'name':
      return 'kebab-case (e.g., "my-skill-name")';
    case 'version':
      return 'Semantic version (e.g., "1.0.0")';
    case 'schema':
      return 'Version number (e.g., "1.0")';
    default:
      return '';
  }
}
