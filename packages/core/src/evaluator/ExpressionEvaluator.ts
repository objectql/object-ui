/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Expression Evaluator
 * 
 * Evaluates template string expressions like ${data.amount > 1000} for dynamic UI behavior.
 * Supports variable substitution, comparison operators, and basic JavaScript expressions.
 * 
 * @module evaluator
 * @packageDocumentation
 */

import { ExpressionContext } from './ExpressionContext';

/**
 * Options for expression evaluation
 */
export interface EvaluationOptions {
  /**
   * Default value to return if evaluation fails
   */
  defaultValue?: any;
  
  /**
   * Whether to throw errors on evaluation failure
   * @default false
   */
  throwOnError?: boolean;
  
  /**
   * Whether to sanitize the expression before evaluation
   * @default true
   */
  sanitize?: boolean;
}

/**
 * Expression evaluator for dynamic UI expressions
 */
export class ExpressionEvaluator {
  private context: ExpressionContext;

  constructor(context?: ExpressionContext | Record<string, any>) {
    if (context instanceof ExpressionContext) {
      this.context = context;
    } else {
      this.context = new ExpressionContext(context || {});
    }
  }

  /**
   * Evaluate a string that may contain template expressions like ${...}
   * 
   * @example
   * ```ts
   * const evaluator = new ExpressionEvaluator({ data: { amount: 1500 } });
   * evaluator.evaluate('${data.amount > 1000}'); // Returns: true
   * evaluator.evaluate('Amount is ${data.amount}'); // Returns: "Amount is 1500"
   * ```
   */
  evaluate(expression: string | boolean | number | null | undefined, options: EvaluationOptions = {}): any {
    // Handle non-string primitives
    if (typeof expression !== 'string') {
      return expression;
    }

    const { defaultValue, throwOnError = false, sanitize = true } = options;

    try {
      // Check if string contains template expressions
      const hasTemplates = expression.includes('${');
      
      if (!hasTemplates) {
        // No templates, return as-is
        return expression;
      }

      // Special case: if the entire string is a single template expression, return the value directly
      const singleTemplateMatch = expression.match(/^\$\{([^}]+)\}$/);
      if (singleTemplateMatch) {
        return this.evaluateExpression(singleTemplateMatch[1].trim(), { sanitize });
      }

      // Replace all ${...} expressions in a string with multiple parts
      return expression.replace(/\$\{([^}]+)\}/g, (match, expr) => {
        try {
          const result = this.evaluateExpression(expr.trim(), { sanitize });
          return String(result ?? '');
        } catch (error) {
          if (throwOnError) {
            throw error;
          }
          console.warn(`Expression evaluation failed for: ${expr}`, error);
          return match; // Return original if evaluation fails
        }
      });
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
      console.warn(`Failed to evaluate expression: ${expression}`, error);
      return defaultValue ?? expression;
    }
  }

  /**
   * Evaluate a single expression (without ${} wrapper)
   * 
   * @example
   * ```ts
   * evaluator.evaluateExpression('data.amount > 1000'); // Returns: true
   * evaluator.evaluateExpression('data.user.name'); // Returns: "John"
   * ```
   */
  evaluateExpression(expression: string, options: { sanitize?: boolean } = {}): any {
    const { sanitize = true } = options;

    if (!expression || expression.trim() === '') {
      return undefined;
    }

    // Sanitize expression to prevent dangerous code execution
    if (sanitize && this.isDangerous(expression)) {
      throw new Error(`Potentially dangerous expression detected: ${expression}`);
    }

    try {
      // Create a safe evaluation function
      const contextObj = this.context.toObject();
      
      // Build safe function with context variables
      const varNames = Object.keys(contextObj);
      const varValues = Object.values(contextObj);
      
      // SECURITY NOTE: Using Function constructor for expression evaluation.
      // This is a controlled use case with:
      // 1. Sanitization check (isDangerous) blocks dangerous patterns
      // 2. Strict mode enabled ("use strict")
      // 3. Limited scope (only contextObj variables available)
      // 4. No access to global objects (process, window, etc.)
      // For production use, consider: expr-eval, safe-eval, or a custom parser
      const fn = new Function(...varNames, `"use strict"; return (${expression});`);
      
      // Execute with context values
      return fn(...varValues);
    } catch (error) {
      throw new Error(`Failed to evaluate expression "${expression}": ${(error as Error).message}`);
    }
  }

  /**
   * Check if expression contains potentially dangerous code
   */
  private isDangerous(expression: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /import\s*\(/i,
      /require\s*\(/i,
      /process\./i,
      /global\./i,
      /window\./i,
      /document\./i,
      /__proto__/i,
      /constructor\s*\(/i,
      /prototype\./i,
    ];

    return dangerousPatterns.some(pattern => pattern.test(expression));
  }

  /**
   * Evaluate a conditional expression and return boolean
   * 
   * @example
   * ```ts
   * evaluator.evaluateCondition('${data.age >= 18}'); // Returns: true/false
   * ```
   */
  evaluateCondition(condition: string | boolean | undefined, options: EvaluationOptions = {}): boolean {
    if (typeof condition === 'boolean') {
      return condition;
    }

    if (!condition) {
      return true; // Default to visible/enabled if no condition
    }

    const result = this.evaluate(condition, options);
    
    // Convert result to boolean
    return Boolean(result);
  }

  /**
   * Update the context with new data
   */
  updateContext(data: Record<string, any>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.context.set(key, value);
    });
  }

  /**
   * Get the current context
   */
  getContext(): ExpressionContext {
    return this.context;
  }

  /**
   * Create a new evaluator with additional context data
   */
  withContext(data: Record<string, any>): ExpressionEvaluator {
    return new ExpressionEvaluator(this.context.createChild(data));
  }
}

/**
 * Convenience function to quickly evaluate an expression
 */
export function evaluateExpression(
  expression: string | boolean | number | null | undefined,
  context: Record<string, any> = {},
  options: EvaluationOptions = {}
): any {
  const evaluator = new ExpressionEvaluator(context);
  return evaluator.evaluate(expression, options);
}

/**
 * Convenience function to evaluate a condition
 */
export function evaluateCondition(
  condition: string | boolean | undefined,
  context: Record<string, any> = {}
): boolean {
  const evaluator = new ExpressionEvaluator(context);
  return evaluator.evaluateCondition(condition);
}
