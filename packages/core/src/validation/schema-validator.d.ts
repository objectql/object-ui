/**
 * @object-ui/core - Schema Validation
 *
 * Runtime validation utilities for Object UI schemas.
 * These utilities help ensure schemas are valid before rendering.
 *
 * @module validation
 * @packageDocumentation
 */
import type { BaseSchema } from '@object-ui/types';
/**
 * Validation error details
 */
export interface ValidationError {
    path: string;
    message: string;
    type: 'error' | 'warning';
    code?: string;
}
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}
/**
 * Validate a complete schema
 *
 * @param schema - The schema to validate
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSchema({
 *   type: 'form',
 *   fields: [
 *     { name: 'email', type: 'input' }
 *   ]
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export declare function validateSchema(schema: any, path?: string): ValidationResult;
/**
 * Assert that a schema is valid, throwing an error if not
 *
 * @param schema - The schema to validate
 * @throws Error if schema is invalid
 *
 * @example
 * ```typescript
 * try {
 *   assertValidSchema(schema);
 *   // Schema is valid, continue rendering
 * } catch (error) {
 *   console.error('Invalid schema:', error.message);
 * }
 * ```
 */
export declare function assertValidSchema(schema: any): asserts schema is BaseSchema;
/**
 * Check if a value is a valid schema
 *
 * @param value - The value to check
 * @returns True if the value is a valid schema
 *
 * @example
 * ```typescript
 * if (isValidSchema(data)) {
 *   renderSchema(data);
 * }
 * ```
 */
export declare function isValidSchema(value: any): value is BaseSchema;
/**
 * Get a human-readable error summary
 *
 * @param result - The validation result
 * @returns Formatted error summary
 */
export declare function formatValidationErrors(result: ValidationResult): string;
