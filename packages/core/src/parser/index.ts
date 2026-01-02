/**
 * Parser module - public API
 *
 * Provides YAML parsing and validation for skill.yaml files.
 *
 * @example
 * ```typescript
 * import { parse, validate, stringify } from '@skillpkg/core/parser';
 *
 * const result = parse(yamlContent);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */

// Parser functions
export { parse, stringify, parseAndValidate } from './parser.js';
export type { ParseResult, ParseError, ParseOptions } from './parser.js';

// Validator functions
export { validate } from './validator.js';
export type { ValidationResult, ValidationError, ValidationWarning } from './validator.js';

// Schema
export { skillSchema, fieldDescriptions } from './schema.js';
