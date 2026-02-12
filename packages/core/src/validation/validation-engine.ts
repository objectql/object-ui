/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Validation Engine
 * 
 * Phase 3.5: Complete validation engine implementation with support for:
 * - Sync and async validation
 * - Cross-field validation
 * - Custom validation functions
 * - Improved error messages
 * 
 * @module validation-engine
 * @packageDocumentation
 */

import type {
  AdvancedValidationSchema,
  AdvancedValidationRule,
  ValidationRuleType,
  ValidationFunction,
  AsyncValidationFunction,
  ValidationContext,
  AdvancedValidationResult,
  AdvancedValidationError,
} from '@object-ui/types';

/**
 * Validation Engine - Executes validation rules
 */
export class ValidationEngine {
  private customValidators = new Map<string, ValidationFunction>();
  private customAsyncValidators = new Map<string, AsyncValidationFunction>();

  /**
   * Register a custom synchronous validator by name
   */
  registerValidator(name: string, fn: ValidationFunction): void {
    this.customValidators.set(name, fn);
  }

  /**
   * Register a custom asynchronous validator by name
   */
  registerAsyncValidator(name: string, fn: AsyncValidationFunction): void {
    this.customAsyncValidators.set(name, fn);
  }

  /**
   * Check if a custom validator is registered
   */
  hasValidator(name: string): boolean {
    return this.customValidators.has(name) || this.customAsyncValidators.has(name);
  }

  /**
   * Get all registered custom validator names
   */
  getValidatorNames(): string[] {
    return [
      ...Array.from(this.customValidators.keys()),
      ...Array.from(this.customAsyncValidators.keys()),
    ];
  }
  /**
   * Validate a value against validation schema
   */
  async validate(
    value: any,
    schema: AdvancedValidationSchema,
    context?: ValidationContext
  ): Promise<AdvancedValidationResult> {
    const errors: AdvancedValidationError[] = [];
    const warnings: AdvancedValidationError[] = [];

    for (const rule of schema.rules) {
      const result = await this.validateRule(value, rule, context);
      
      if (result) {
        const error: AdvancedValidationError = {
          field: schema.field || 'unknown',
          message: result,
          code: rule.type,
          rule: rule.type,
          severity: rule.severity || 'error',
        };

        if (rule.severity === 'warning' || rule.severity === 'info') {
          warnings.push(error);
        } else {
          errors.push(error);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single rule
   */
  private async validateRule(
    value: any,
    rule: AdvancedValidationRule,
    context?: ValidationContext
  ): Promise<string | null> {
    // Custom async validator (inline)
    if (rule.async_validator) {
      const result = await rule.async_validator(value, context);
      if (result === false) {
        return rule.message || 'Async validation failed';
      }
      if (typeof result === 'string') {
        return result;
      }
      return null;
    }

    // Custom sync validator (inline)
    if (rule.validator) {
      const result = rule.validator(value, context);
      if (result === false) {
        return rule.message || 'Validation failed';
      }
      if (typeof result === 'string') {
        return result;
      }
      return null;
    }

    // Registered custom async validator (by name)
    const registeredAsync = this.customAsyncValidators.get(rule.type);
    if (registeredAsync) {
      const result = await registeredAsync(value, context);
      if (result === false) {
        return rule.message || 'Async validation failed';
      }
      if (typeof result === 'string') {
        return result;
      }
      return null;
    }

    // Registered custom sync validator (by name)
    const registeredSync = this.customValidators.get(rule.type);
    if (registeredSync) {
      const result = registeredSync(value, context);
      if (result === false) {
        return rule.message || 'Validation failed';
      }
      if (typeof result === 'string') {
        return result;
      }
      return null;
    }

    // Built-in validators
    return this.validateBuiltInRule(value, rule, context);
  }

  /**
   * Validate built-in rules
   */
  private async validateBuiltInRule(
    value: any,
    rule: AdvancedValidationRule,
    context?: ValidationContext
  ): Promise<string | null> {
    const { type, params, message } = rule;

    switch (type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return message || 'This field is required';
        }
        break;

      case 'min_length':
        if (typeof value === 'string' && value.length < params) {
          return message || `Minimum length is ${params} characters`;
        }
        break;

      case 'max_length':
        if (typeof value === 'string' && value.length > params) {
          return message || `Maximum length is ${params} characters`;
        }
        break;

      case 'pattern':
        if (typeof value === 'string') {
          try {
            const regex = typeof params === 'string' ? new RegExp(params) : params;
            if (!regex.test(value)) {
              return message || 'Invalid format';
            }
          } catch (error) {
            return message || 'Invalid pattern configuration';
          }
        }
        break;

      case 'email':
        if (typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return message || 'Invalid email address';
          }
        }
        break;

      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            return message || 'Invalid URL';
          }
        }
        break;

      case 'phone':
        if (typeof value === 'string') {
          const phoneRegex = /^[\d\s\-+()]+$/;
          if (!phoneRegex.test(value)) {
            return message || 'Invalid phone number';
          }
        }
        break;

      case 'min':
        if (typeof value === 'number' && value < params) {
          return message || `Minimum value is ${params}`;
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > params) {
          return message || `Maximum value is ${params}`;
        }
        break;

      case 'integer':
        if (typeof value === 'number' && !Number.isInteger(value)) {
          return message || 'Value must be an integer';
        }
        break;

      case 'positive':
        if (typeof value === 'number' && value <= 0) {
          return message || 'Value must be positive';
        }
        break;

      case 'negative':
        if (typeof value === 'number' && value >= 0) {
          return message || 'Value must be negative';
        }
        break;

      case 'date_min':
        if (value instanceof Date || typeof value === 'string') {
          const date = value instanceof Date ? value : new Date(value);
          const minDate = params instanceof Date ? params : new Date(params);
          if (date < minDate) {
            return message || `Date must be after ${minDate.toLocaleDateString()}`;
          }
        }
        break;

      case 'date_max':
        if (value instanceof Date || typeof value === 'string') {
          const date = value instanceof Date ? value : new Date(value);
          const maxDate = params instanceof Date ? params : new Date(params);
          if (date > maxDate) {
            return message || `Date must be before ${maxDate.toLocaleDateString()}`;
          }
        }
        break;

      case 'date_future':
        if (value instanceof Date || typeof value === 'string') {
          const date = value instanceof Date ? value : new Date(value);
          if (date <= new Date()) {
            return message || 'Date must be in the future';
          }
        }
        break;

      case 'date_past':
        if (value instanceof Date || typeof value === 'string') {
          const date = value instanceof Date ? value : new Date(value);
          if (date >= new Date()) {
            return message || 'Date must be in the past';
          }
        }
        break;

      case 'min_items':
        if (Array.isArray(value) && value.length < params) {
          return message || `Minimum ${params} items required`;
        }
        break;

      case 'max_items':
        if (Array.isArray(value) && value.length > params) {
          return message || `Maximum ${params} items allowed`;
        }
        break;

      case 'unique_items':
        if (Array.isArray(value)) {
          const unique = new Set(value);
          if (unique.size !== value.length) {
            return message || 'All items must be unique';
          }
        }
        break;

      case 'field_match':
        if (context?.values && params) {
          const otherValue = context.values[params];
          if (value !== otherValue) {
            return message || `Value must match ${params}`;
          }
        }
        break;

      case 'field_compare':
        if (context?.values && params) {
          const { field: otherField, operator } = params;
          const otherValue = context.values[otherField];
          
          switch (operator) {
            case '>':
              if (value <= otherValue) {
                return message || `Value must be greater than ${otherField}`;
              }
              break;
            case '<':
              if (value >= otherValue) {
                return message || `Value must be less than ${otherField}`;
              }
              break;
            case '>=':
              if (value < otherValue) {
                return message || `Value must be greater than or equal to ${otherField}`;
              }
              break;
            case '<=':
              if (value > otherValue) {
                return message || `Value must be less than or equal to ${otherField}`;
              }
              break;
          }
        }
        break;

      case 'conditional':
        if (context?.values && params) {
          const { condition, rules } = params;
          
          if (!Array.isArray(rules) || rules.length === 0) {
            break;
          }
          
          const conditionMet = this.evaluateCondition(condition, context.values);
          
          if (conditionMet) {
            for (const conditionalRule of rules) {
              const result = await this.validateRule(value, conditionalRule, context);
              if (result) {
                return result;
              }
            }
          }
        }
        break;
      
      default:
        // Unhandled validation rule type
        console.warn(`Unsupported validation rule type: ${type}`);
        return null;
    }

    return null;
  }

  /**
   * Evaluate a condition
   * Note: Conditions must be declarative objects, not functions, for security.
   */
  private evaluateCondition(condition: any, values: Record<string, any>): boolean {
    if (typeof condition === 'function') {
      console.warn(
        'Function-based conditions are deprecated and will be removed. Use declarative conditions instead.\n\n' +
        '  Migration:\n' +
        '  // Before (deprecated):\n' +
        '  { condition: (values) => values.age > 18 }\n\n' +
        '  // After:\n' +
        '  { condition: { field: "age", operator: ">", value: 18 } }\n\n' +
        '  See: https://github.com/objectstack-ai/objectui/blob/main/MIGRATION_GUIDE.md'
      );
      return false; // Security: reject function-based conditions
    }
    
    if (typeof condition === 'object' && condition.field) {
      const fieldValue = values[condition.field];
      const { operator = '=', value } = condition;
      
      switch (operator) {
        case '=':
          return fieldValue === value;
        case '!=':
          return fieldValue !== value;
        case '>':
          return fieldValue > value;
        case '<':
          return fieldValue < value;
        case '>=':
          return fieldValue >= value;
        case '<=':
          return fieldValue <= value;
        case 'in':
          return Array.isArray(value) && value.includes(fieldValue);
        default:
          return false;
      }
    }
    
    return false;
  }

  /**
   * Validate multiple fields
   */
  async validateFields(
    values: Record<string, any>,
    schemas: Record<string, AdvancedValidationSchema>
  ): Promise<Record<string, AdvancedValidationResult>> {
    const results: Record<string, AdvancedValidationResult> = {};
    
    const context: ValidationContext = {
      values,
    };

    for (const [field, schema] of Object.entries(schemas)) {
      const value = values[field];
      const schemaWithField: AdvancedValidationSchema = {
        ...schema,
        field: schema.field ?? field,
      };
      results[field] = await this.validate(value, schemaWithField, context);
    }

    return results;
  }

  /**
   * Check if all fields are valid
   */
  isValid(results: Record<string, AdvancedValidationResult>): boolean {
    return Object.values(results).every(result => result.valid);
  }

  /**
   * Get all errors from validation results
   */
  getAllErrors(results: Record<string, AdvancedValidationResult>): AdvancedValidationError[] {
    const errors: AdvancedValidationError[] = [];
    
    for (const result of Object.values(results)) {
      errors.push(...result.errors);
    }
    
    return errors;
  }

  /**
   * Get all warnings from validation results
   */
  getAllWarnings(results: Record<string, AdvancedValidationResult>): AdvancedValidationError[] {
    const warnings: AdvancedValidationError[] = [];
    
    for (const result of Object.values(results)) {
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    }
    
    return warnings;
  }
}

/**
 * Default validation engine instance
 */
export const defaultValidationEngine = new ValidationEngine();

/**
 * Convenience function to validate a value
 */
export async function validate(
  value: any,
  schema: AdvancedValidationSchema,
  context?: ValidationContext
): Promise<AdvancedValidationResult> {
  return defaultValidationEngine.validate(value, schema, context);
}

/**
 * Convenience function to validate multiple fields
 */
export async function validateFields(
  values: Record<string, any>,
  schemas: Record<string, AdvancedValidationSchema>
): Promise<Record<string, AdvancedValidationResult>> {
  return defaultValidationEngine.validateFields(values, schemas);
}
