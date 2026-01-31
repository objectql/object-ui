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
 * Simple expression evaluator using a simple parser (no dynamic code execution)
 * 
 * SECURITY: This implementation parses expressions into an AST and evaluates them
 * without using eval() or new Function(). It supports:
 * - Comparison operators: ==, !=, >, <, >=, <=
 * - Logical operators: &&, ||, !
 * - Property access: record.field, record['field']
 * - Literals: true, false, null, numbers, strings
 * 
 * LIMITATIONS:
 * - Single comparison operator per expression (no chaining like a > b > c)
 * - Simple escape sequence handling (doesn't handle escaped backslashes)
 * - Field names in bracket notation cannot contain escaped quotes
 * 
 * For more complex expressions, integrate a dedicated library like:
 * - JSONLogic (jsonlogic.com)
 * - filtrex
 * 
 * @see https://github.com/objectstack-ai/objectui/blob/main/SECURITY_FIX_SUMMARY.md
 */
class SimpleExpressionEvaluator implements ValidationExpressionEvaluator {
  evaluate(expression: string, context: Record<string, any>): any {
    try {
      return this.evaluateSafeExpression(expression.trim(), context);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Safely evaluate an expression without using dynamic code execution
   */
  private evaluateSafeExpression(expr: string, context: Record<string, any>): any {
    // Handle boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    
    // Handle string literals
    if ((expr.startsWith('"') && expr.endsWith('"')) || 
        (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }
    
    // Handle numeric literals
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }
    
    // Handle logical NOT
    if (expr.startsWith('!')) {
      return !this.evaluateSafeExpression(expr.slice(1).trim(), context);
    }
    
    // Handle logical AND
    if (expr.includes('&&')) {
      const parts = this.splitOnOperator(expr, '&&');
      return parts.every(part => this.evaluateSafeExpression(part, context));
    }
    
    // Handle logical OR
    if (expr.includes('||')) {
      const parts = this.splitOnOperator(expr, '||');
      return parts.some(part => this.evaluateSafeExpression(part, context));
    }
    
    // Handle comparison operators
    const comparisonMatch = expr.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, op, right] = comparisonMatch;
      const leftVal = this.evaluateSafeExpression(left.trim(), context);
      const rightVal = this.evaluateSafeExpression(right.trim(), context);
      
      switch (op) {
        case '===':
          return leftVal === rightVal;
        case '==':
          // Use loose equality for backward compatibility with existing expressions
          // eslint-disable-next-line eqeqeq
          return leftVal == rightVal;
        case '!==':
          return leftVal !== rightVal;
        case '!=':
          // Use loose inequality for backward compatibility with existing expressions
          // eslint-disable-next-line eqeqeq
          return leftVal != rightVal;
        case '>': return leftVal > rightVal;
        case '<': return leftVal < rightVal;
        case '>=': return leftVal >= rightVal;
        case '<=': return leftVal <= rightVal;
        default: return false;
      }
    }
    
    // Handle property access (e.g., record.field or context.field)
    return this.getValueFromContext(expr, context);
  }

  /**
   * Split expression on operator, respecting parentheses and quotes
   */
  private splitOnOperator(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      const nextChar = expr[i + 1];
      const prevChar = i > 0 ? expr[i - 1] : '';
      
      // Handle string quotes, checking for escape sequences
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString && prevChar !== '\\') {
        // Only close string if quote is not escaped
        inString = false;
      }
      
      if (!inString) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        
        if (depth === 0 && char === operator[0] && nextChar === operator[1]) {
          parts.push(current.trim());
          current = '';
          i++; // Skip next character
          continue;
        }
      }
      
      current += char;
    }
    
    if (current) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * Get value from context by path (e.g., "record.age" or "age")
   */
  private getValueFromContext(path: string, context: Record<string, any>): any {
    // Handle bracket notation: record['field']
    const bracketMatch = path.match(/^(\w+)\['([^']+)'\]$/);
    if (bracketMatch) {
      const [, obj, field] = bracketMatch;
      return context[obj]?.[field];
    }
    
    // Handle dot notation: record.field or just field
    const parts = path.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Try direct context access for simple identifiers
        if (parts.length === 1 && part in context) {
          return context[part];
        }
        return undefined;
      }
    }
    
    return value;
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
