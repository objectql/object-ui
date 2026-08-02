/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
 * One issue found while walking an ObjectUI schema TREE — `path` locates the
 * offending node (e.g. `children[0].type`), and `type` says whether it is fatal.
 *
 * NOT the spec's `ValidationError` (`@objectstack/spec/kernel`), whose name this
 * interface carried until objectstack#4115. That one describes PLUGIN-manifest
 * validation and is keyed by `field`, with no severity discriminant. The two
 * share no key beyond `message`/`code`.
 *
 * Naming convention for this family, set here and followed by the rest of the
 * burn-down: `<what-is-validated>Validation<Error|Result>`. (`SchemaValidationResult`
 * and `SchemaValidationReport` are themselves spec exports — checked, not assumed.)
 */
export interface SchemaNodeValidationError {
  path: string;
  message: string;
  type: 'error' | 'warning';
  code?: string;
}

/**
 * The outcome of validating an ObjectUI schema tree.
 *
 * NOT the spec's `ValidationResult` (`@objectstack/spec/kernel` and
 * `@objectstack/spec/contracts`), whose name this interface carried until
 * objectstack#4115: there `errors`/`warnings` are OPTIONAL arrays of
 * `{ field, message, code? }` describing a plugin manifest. Here both arrays are
 * required and carry node paths.
 */
export interface SchemaNodeValidationResult {
  valid: boolean;
  errors: SchemaNodeValidationError[];
  warnings: SchemaNodeValidationError[];
}

/**
 * Validation rules for base schema
 */
const BASE_SCHEMA_RULES = {
  type: {
    required: true,
    validate: (value: any) => typeof value === 'string' && value.length > 0,
    message: 'type must be a non-empty string'
  },
  id: {
    required: false,
    validate: (value: any) => typeof value === 'string',
    message: 'id must be a string'
  },
  className: {
    required: false,
    validate: (value: any) => typeof value === 'string',
    message: 'className must be a string'
  },
  visible: {
    required: false,
    validate: (value: any) => typeof value === 'boolean',
    message: 'visible must be a boolean'
  },
  disabled: {
    required: false,
    validate: (value: any) => typeof value === 'boolean',
    message: 'disabled must be a boolean'
  }
};

/**
 * Validate a schema against base rules
 */
function validateBaseSchema(schema: any, path: string = 'schema'): SchemaNodeValidationError[] {
  const errors: SchemaNodeValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    errors.push({
      path,
      message: 'Schema must be an object',
      type: 'error',
      code: 'INVALID_SCHEMA'
    });
    return errors;
  }

  // Validate required and optional properties
  Object.entries(BASE_SCHEMA_RULES).forEach(([key, rule]) => {
    const value = schema[key];
    
    if (rule.required && value === undefined) {
      errors.push({
        path: `${path}.${key}`,
        message: `${key} is required`,
        type: 'error',
        code: 'MISSING_REQUIRED'
      });
    }
    
    if (value !== undefined && !rule.validate(value)) {
      errors.push({
        path: `${path}.${key}`,
        message: rule.message,
        type: 'error',
        code: 'INVALID_TYPE'
      });
    }
  });

  return errors;
}

/**
 * Validate CRUD schema specific properties
 */
function validateCRUDSchema(schema: any, path: string = 'schema'): SchemaNodeValidationError[] {
  const errors: SchemaNodeValidationError[] = [];

  if (schema.type === 'crud') {
    // Check required properties for CRUD
    if (!schema.columns || !Array.isArray(schema.columns)) {
      errors.push({
        path: `${path}.columns`,
        message: 'CRUD schema requires columns array',
        type: 'error',
        code: 'MISSING_COLUMNS'
      });
    }

    if (!schema.api && !schema.dataSource) {
      errors.push({
        path: `${path}.api`,
        message: 'CRUD schema requires api or dataSource',
        type: 'warning',
        code: 'MISSING_DATA_SOURCE'
      });
    }

    // Validate columns
    if (schema.columns && Array.isArray(schema.columns)) {
      schema.columns.forEach((column: any, index: number) => {
        if (!column.name) {
          errors.push({
            path: `${path}.columns[${index}]`,
            message: 'Column requires name property',
            type: 'error',
            code: 'MISSING_COLUMN_NAME'
          });
        }
      });
    }

    // Validate fields if present
    if (schema.fields && Array.isArray(schema.fields)) {
      schema.fields.forEach((field: any, index: number) => {
        if (!field.name) {
          errors.push({
            path: `${path}.fields[${index}]`,
            message: 'Field requires name property',
            type: 'error',
            code: 'MISSING_FIELD_NAME'
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Validate form schema specific properties
 */
function validateFormSchema(schema: any, path: string = 'schema'): SchemaNodeValidationError[] {
  const errors: SchemaNodeValidationError[] = [];

  if (schema.type === 'form') {
    if (schema.fields && Array.isArray(schema.fields)) {
      schema.fields.forEach((field: any, index: number) => {
        if (!field.name) {
          errors.push({
            path: `${path}.fields[${index}]`,
            message: 'Form field requires name property',
            type: 'error',
            code: 'MISSING_FIELD_NAME'
          });
        }

        // Check for duplicate field names
        const duplicates = schema.fields.filter((f: any) => f.name === field.name);
        if (duplicates.length > 1) {
          errors.push({
            path: `${path}.fields[${index}]`,
            message: `Duplicate field name: ${field.name}`,
            type: 'warning',
            code: 'DUPLICATE_FIELD_NAME'
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Validate child schemas recursively
 */
function validateChildren(schema: any, path: string = 'schema'): SchemaNodeValidationError[] {
  const errors: SchemaNodeValidationError[] = [];

  const children = schema.children || schema.body;
  if (children) {
    if (Array.isArray(children)) {
      children.forEach((child: any, index: number) => {
        if (typeof child === 'object' && child !== null) {
          const childResult = validateSchema(child, `${path}.children[${index}]`);
          errors.push(...childResult.errors, ...childResult.warnings);
        }
      });
    } else if (typeof children === 'object' && children !== null) {
      const childResult = validateSchema(children, `${path}.children`);
      errors.push(...childResult.errors, ...childResult.warnings);
    }
  }

  return errors;
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
export function validateSchema(
  schema: any,
  path: string = 'schema'
): SchemaNodeValidationResult {
  const allErrors: SchemaNodeValidationError[] = [];

  // Validate base schema
  allErrors.push(...validateBaseSchema(schema, path));

  // Validate type-specific schemas
  allErrors.push(...validateCRUDSchema(schema, path));
  allErrors.push(...validateFormSchema(schema, path));

  // Validate children recursively
  allErrors.push(...validateChildren(schema, path));

  const errors = allErrors.filter(e => e.type === 'error');
  const warnings = allErrors.filter(e => e.type === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

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
export function assertValidSchema(schema: any): asserts schema is BaseSchema {
  const result = validateSchema(schema);
  
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`Schema validation failed:\n${errorMessages}`);
  }
}

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
export function isValidSchema(value: any): value is BaseSchema {
  const result = validateSchema(value);
  return result.valid;
}

/**
 * Get a human-readable error summary
 * 
 * @param result - The validation result
 * @returns Formatted error summary
 */
export function formatValidationErrors(result: SchemaNodeValidationResult): string {
  const parts: string[] = [];

  if (result.errors.length > 0) {
    parts.push('Errors:');
    result.errors.forEach(error => {
      parts.push(`  - ${error.path}: ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    parts.push('Warnings:');
    result.warnings.forEach(warning => {
      parts.push(`  - ${warning.path}: ${warning.message}`);
    });
  }

  return parts.join('\n');
}
