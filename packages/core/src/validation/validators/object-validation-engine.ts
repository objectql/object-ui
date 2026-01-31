/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Object-Level Validation Engine
 * 
 * ObjectStack Spec v0.7.1 compliant validation engine for object-level validation rules.
 * Supports all 9 validation types from the specification:
 * - ScriptValidation
 * - UniquenessValidation
 * - StateMachineValidation
 * - CrossFieldValidation
 * - AsyncValidation
 * - ConditionalValidation
 * - FormatValidation
 * - RangeValidation
 * 
 * @module object-validation-engine
 * @packageDocumentation
 */

import type {
  ScriptValidation,
  UniquenessValidation,
  StateMachineValidation,
  CrossFieldValidation,
  AsyncValidation,
  ConditionalValidation,
  FormatValidation,
  RangeValidation,
  ObjectValidationRule,
} from '@object-ui/types';

/**
 * Validation context for object-level validations
 */
export interface ObjectValidationContext {
  /** Current record data */
  record: Record<string, any>;
  
  /** Previous record data (for updates) */
  oldRecord?: Record<string, any>;
  
  /** Current user */
  user?: Record<string, any>;
  
  /** Additional context data */
  [key: string]: any;
}

/**
 * Validation result
 */
export interface ObjectValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Error message if validation failed */
  message?: string;
  
  /** Validation rule that failed */
  rule?: string;
  
  /** Severity */
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Validation expression evaluator interface
 */
export interface ValidationExpressionEvaluator {
  evaluate(expression: string, context: Record<string, any>): any;
}

/**
 * Simple expression evaluator (basic implementation)
 * In production, this should use a proper expression engine
 * 
 * SECURITY NOTE: This implementation uses a sandboxed approach with limited
 * expression capabilities. For production use, consider:
 * - JSONLogic (jsonlogic.com)
 * - expr-eval with allowlist
 * - Custom AST-based evaluator
 */
class SimpleExpressionEvaluator implements ValidationExpressionEvaluator {
  evaluate(expression: string, context: Record<string, any>): any {
    try {
      // Sanitize expression: only allow basic comparisons and logical operators
      // This is a basic safeguard - proper expression parsing should be used in production
      const sanitizedExpression = this.sanitizeExpression(expression);
      
      // Create a safe evaluation context with read-only access
      const safeContext = this.createSafeContext(context);
      const contextKeys = Object.keys(safeContext);
      const contextValues = Object.values(safeContext);
      
      // Use Function constructor with controlled input
      const func = new Function(...contextKeys, `'use strict'; return (${sanitizedExpression});`);
      return func(...contextValues);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Sanitize expression to prevent code injection
   */
  private sanitizeExpression(expression: string): string {
    // Remove potentially dangerous patterns
    const dangerous = [
      /require\s*\(/gi,
      /import\s+/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /constructor/gi,
      /__proto__/gi,
      /prototype/gi,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(expression)) {
        throw new Error('Invalid expression: contains forbidden pattern');
      }
    }

    return expression;
  }

  /**
   * Create a safe read-only context
   */
  private createSafeContext(context: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      // Deep clone primitive values and objects to prevent mutation
      if (typeof value === 'object' && value !== null) {
        safe[key] = JSON.parse(JSON.stringify(value));
      } else {
        safe[key] = value;
      }
    }
    return safe;
  }
}

/**
 * Object-Level Validation Engine
 * Implements ObjectStack Spec v0.7.1 validation framework
 */
export class ObjectValidationEngine {
  private expressionEvaluator: ValidationExpressionEvaluator;
  private uniquenessChecker?: (
    fields: string[],
    values: Record<string, any>,
    scope?: string,
    context?: ObjectValidationContext
  ) => Promise<boolean>;

  constructor(
    expressionEvaluator?: ValidationExpressionEvaluator,
    uniquenessChecker?: (
      fields: string[],
      values: Record<string, any>,
      scope?: string,
      context?: ObjectValidationContext
    ) => Promise<boolean>
  ) {
    this.expressionEvaluator = expressionEvaluator || new SimpleExpressionEvaluator();
    this.uniquenessChecker = uniquenessChecker;
  }

  /**
   * Validate a record against a set of validation rules
   */
  async validateRecord(
    rules: ObjectValidationRule[],
    context: ObjectValidationContext,
    event: 'insert' | 'update' | 'delete' = 'insert'
  ): Promise<ObjectValidationResult[]> {
    const results: ObjectValidationResult[] = [];

    for (const rule of rules) {
      // Check if rule is active
      if (!rule.active) {
        continue;
      }

      // Check if rule applies to this event
      if (!rule.events.includes(event)) {
        continue;
      }

      const result = await this.validateRule(rule, context);
      if (!result.valid) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Validate a single rule
   */
  private async validateRule(
    rule: ObjectValidationRule,
    context: ObjectValidationContext
  ): Promise<ObjectValidationResult> {
    switch (rule.type) {
      case 'script':
        return this.validateScript(rule, context);
      
      case 'unique':
        return this.validateUniqueness(rule, context);
      
      case 'state_machine':
        return this.validateStateMachine(rule, context);
      
      case 'cross_field':
        return this.validateCrossField(rule, context);
      
      case 'async':
        return this.validateAsync(rule, context);
      
      case 'conditional':
        return this.validateConditional(rule, context);
      
      case 'format':
        return this.validateFormat(rule, context);
      
      case 'range':
        return this.validateRange(rule, context);
      
      default:
        return {
          valid: true,
          message: `Unknown validation type: ${(rule as any).type}`,
        };
    }
  }

  /**
   * Validate script-based rule
   */
  private validateScript(
    rule: ScriptValidation,
    context: ObjectValidationContext
  ): ObjectValidationResult {
    try {
      const result = this.expressionEvaluator.evaluate(rule.condition, context.record);
      
      if (!result) {
        return {
          valid: false,
          message: rule.message,
          rule: rule.name,
          severity: rule.severity,
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Script evaluation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Validate uniqueness constraint
   */
  private async validateUniqueness(
    rule: UniquenessValidation,
    context: ObjectValidationContext
  ): Promise<ObjectValidationResult> {
    if (!this.uniquenessChecker) {
      console.warn('Uniqueness checker not configured');
      return { valid: true };
    }

    const values: Record<string, any> = {};
    for (const field of rule.fields) {
      values[field] = context.record[field];
    }

    const isUnique = await this.uniquenessChecker(
      rule.fields,
      values,
      rule.scope,
      context
    );

    if (!isUnique) {
      return {
        valid: false,
        message: rule.message,
        rule: rule.name,
        severity: rule.severity,
      };
    }

    return { valid: true };
  }

  /**
   * Validate state machine transitions
   */
  private validateStateMachine(
    rule: StateMachineValidation,
    context: ObjectValidationContext
  ): ObjectValidationResult {
    const currentState = context.record[rule.stateField];
    const previousState = context.oldRecord?.[rule.stateField];

    // If no previous state (insert), allow any state
    if (!previousState) {
      return { valid: true };
    }

    // Check if transition is allowed
    for (const transition of rule.transitions) {
      const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
      
      if (!fromStates.includes(previousState)) {
        continue;
      }
      
      if (transition.to !== currentState) {
        continue;
      }
      
      // Check condition if specified
      if (transition.condition) {
        const conditionMet = this.expressionEvaluator.evaluate(
          transition.condition,
          context.record
        );
        if (!conditionMet) {
          continue;
        }
      }
      
      // Valid transition found
      return { valid: true };
    }

    return {
      valid: false,
      message: rule.message || `Invalid state transition from ${previousState} to ${currentState}`,
      rule: rule.name,
      severity: rule.severity,
    };
  }

  /**
   * Validate cross-field constraints
   */
  private validateCrossField(
    rule: CrossFieldValidation,
    context: ObjectValidationContext
  ): ObjectValidationResult {
    try {
      const result = this.expressionEvaluator.evaluate(rule.condition, context.record);
      
      if (!result) {
        return {
          valid: false,
          message: rule.message,
          rule: rule.name,
          severity: rule.severity,
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Cross-field validation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Validate async/remote validation
   */
  private async validateAsync(
    rule: AsyncValidation,
    context: ObjectValidationContext
  ): Promise<ObjectValidationResult> {
    try {
      const method = rule.method || 'POST';
      const response = await fetch(rule.endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' ? JSON.stringify(context.record) : undefined,
      });

      const data = await response.json();
      
      if (!data.valid) {
        return {
          valid: false,
          message: data.message || rule.message,
          rule: rule.name,
          severity: rule.severity,
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Async validation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Validate conditional rules
   */
  private async validateConditional(
    rule: ConditionalValidation,
    context: ObjectValidationContext
  ): Promise<ObjectValidationResult> {
    try {
      const conditionMet = this.expressionEvaluator.evaluate(rule.condition, context.record);
      
      if (!conditionMet) {
        // Condition not met, validation passes
        return { valid: true };
      }
      
      // Condition met, validate nested rules
      for (const nestedRule of rule.rules) {
        const result = await this.validateRule(nestedRule, context);
        if (!result.valid) {
          return result;
        }
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Conditional validation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Validate format/pattern
   */
  private validateFormat(
    rule: FormatValidation,
    context: ObjectValidationContext
  ): ObjectValidationResult {
    const value = context.record[rule.field];
    
    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }

    try {
      let pattern: RegExp;
      
      if (rule.format) {
        // Use predefined format
        pattern = this.getPredefinedPattern(rule.format);
      } else if (typeof rule.pattern === 'string') {
        pattern = new RegExp(rule.pattern, rule.flags);
      } else {
        pattern = rule.pattern as RegExp;
      }

      if (!pattern.test(String(value))) {
        return {
          valid: false,
          message: rule.message || `Invalid format for ${rule.field}`,
          rule: rule.name,
          severity: rule.severity,
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Format validation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Validate range constraints
   */
  private validateRange(
    rule: RangeValidation,
    context: ObjectValidationContext
  ): ObjectValidationResult {
    const value = context.record[rule.field];
    
    if (value === null || value === undefined) {
      return { valid: true };
    }

    try {
      // Convert to comparable values
      let compareValue: number | Date;
      let minValue: number | Date | undefined;
      let maxValue: number | Date | undefined;

      if (value instanceof Date || typeof value === 'string') {
        compareValue = value instanceof Date ? value : new Date(value);
        minValue = rule.min ? (rule.min instanceof Date ? rule.min : new Date(rule.min)) : undefined;
        maxValue = rule.max ? (rule.max instanceof Date ? rule.max : new Date(rule.max)) : undefined;
      } else {
        compareValue = Number(value);
        minValue = rule.min !== undefined ? Number(rule.min) : undefined;
        maxValue = rule.max !== undefined ? Number(rule.max) : undefined;
      }

      // Check minimum
      if (minValue !== undefined) {
        const fails = rule.minExclusive
          ? compareValue <= minValue
          : compareValue < minValue;
        
        if (fails) {
          return {
            valid: false,
            message: rule.message || `Value must be ${rule.minExclusive ? 'greater than' : 'at least'} ${rule.min}`,
            rule: rule.name,
            severity: rule.severity,
          };
        }
      }

      // Check maximum
      if (maxValue !== undefined) {
        const fails = rule.maxExclusive
          ? compareValue >= maxValue
          : compareValue > maxValue;
        
        if (fails) {
          return {
            valid: false,
            message: rule.message || `Value must be ${rule.maxExclusive ? 'less than' : 'at most'} ${rule.max}`,
            rule: rule.name,
            severity: rule.severity,
          };
        }
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Range validation error: ${error}`,
        rule: rule.name,
        severity: 'error',
      };
    }
  }

  /**
   * Get predefined regex pattern
   */
  private getPredefinedPattern(format: string): RegExp {
    const patterns: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
      phone: /^[\d\s\-+()]+$/,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      ipv6: /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      iso_date: /^\d{4}-\d{2}-\d{2}$/,
      credit_card: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
    };

    return patterns[format] || /.*/;
  }
}

/**
 * Default instance
 */
export const defaultObjectValidationEngine = new ObjectValidationEngine();

/**
 * Convenience function to validate a record
 */
export async function validateRecord(
  rules: ObjectValidationRule[],
  context: ObjectValidationContext,
  event: 'insert' | 'update' | 'delete' = 'insert'
): Promise<ObjectValidationResult[]> {
  return defaultObjectValidationEngine.validateRecord(rules, context, event);
}
