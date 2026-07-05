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

import { ExpressionContext } from './ExpressionContext.js';
import { ExpressionCache } from './ExpressionCache.js';
import { FormulaFunctions } from './FormulaFunctions.js';

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
  private cache: ExpressionCache;
  private formulas: FormulaFunctions;

  constructor(
    context?: ExpressionContext | Record<string, any>,
    cache?: ExpressionCache,
    formulas?: FormulaFunctions,
  ) {
    if (context instanceof ExpressionContext) {
      this.context = context;
    } else {
      this.context = new ExpressionContext(context || {});
    }
    
    // Use provided cache or create a new one
    this.cache = cache || new ExpressionCache();
    this.formulas = formulas || new FormulaFunctions();
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
  evaluate(expression: string | boolean | number | null | undefined | { dialect?: string; source?: string }, options: EvaluationOptions = {}): any {
    // Unwrap Expression envelope produced by `@objectstack/spec`'s normalized
    // template/CEL inputs: `{ dialect: 'cel' | 'template', source: '...' }`.
    // We only consume `source` — the underlying syntax (`${expr}` or `{var}`)
    // is identical to what we already supported as plain strings.
    if (expression && typeof expression === 'object' && typeof (expression as any).source === 'string') {
      expression = (expression as any).source as string;
    }

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
      
      // Inject formula functions into the evaluation context
      const formulaObj = this.formulas.toObject();
      const mergedContext = { ...formulaObj, ...contextObj };
      
      // Build safe function with context variables
      const varNames = Object.keys(mergedContext);
      const varValues = Object.values(mergedContext);
      
      // Use cached compilation
      const compiled = this.cache.compile(expression, varNames);
      
      // Execute with context values
      return compiled.fn(...varValues);
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
  evaluateCondition(condition: string | boolean | undefined | { dialect?: string; source?: string }, options: EvaluationOptions = {}): boolean {
    if (typeof condition === 'boolean') {
      return condition;
    }

    // Unwrap Expression envelope (see `evaluate` for rationale).
    if (condition && typeof condition === 'object' && typeof (condition as any).source === 'string') {
      condition = (condition as any).source as string;
    }

    // No condition → default to visible/enabled (undefined, null, '').
    if (!condition) {
      return true;
    }

    if (typeof condition !== 'string') {
      return Boolean(condition);
    }

    const trimmed = condition.trim();
    if (!trimmed) {
      return true; // Whitespace-only → treat as "no condition".
    }

    // A condition is semantically a single boolean expression. When it's a
    // `${...}` template, evaluate via the template path. Otherwise treat the
    // ENTIRE string as one expression (bare CEL like `record.status == "x"`):
    // `evaluate` would short-circuit a non-`${}` string and return it verbatim,
    // so `Boolean('record.status == "x"')` was ALWAYS true — silently making
    // every bare-expression `disabled`/`condition`/`visible` predicate truthy.
    if (trimmed.includes('${')) {
      return Boolean(this.evaluate(trimmed, options));
    }
    try {
      return Boolean(this.evaluateExpression(trimmed, { sanitize: options.sanitize !== false }));
    } catch (error) {
      // Unparseable predicate — preserve the historical "default to
      // visible/enabled" behaviour rather than hiding/blocking on a typo,
      // UNLESS the caller opted into fail-closed semantics (mirrors the
      // `${...}` template path above, which already honors this).
      if (options.throwOnError) {
        throw error;
      }
      return true;
    }
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
    // Share the cache and formulas with the new evaluator for maximum efficiency
    return new ExpressionEvaluator(this.context.createChild(data), this.cache, this.formulas);
  }
  
  /**
   * Get cache statistics (useful for debugging and optimization)
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear the expression cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the formula functions registry
   */
  getFormulas(): FormulaFunctions {
    return this.formulas;
  }

  /**
   * Register a custom formula function
   */
  registerFunction(name: string, fn: (...args: any[]) => any): void {
    this.formulas.register(name, fn);
  }
}

/**
 * Shared global cache and formulas for convenience functions
 */
const globalCache = new ExpressionCache();
const globalFormulas = new FormulaFunctions();

/**
 * Convenience function to quickly evaluate an expression
 */
export function evaluateExpression(
  expression: string | boolean | number | null | undefined,
  context: Record<string, any> = {},
  options: EvaluationOptions = {}
): any {
  const evaluator = new ExpressionEvaluator(context, globalCache, globalFormulas);
  return evaluator.evaluate(expression, options);
}

/**
 * Convenience function to evaluate a condition
 */
export function evaluateCondition(
  condition: string | boolean | undefined,
  context: Record<string, any> = {}
): boolean {
  const evaluator = new ExpressionEvaluator(context, globalCache, globalFormulas);
  return evaluator.evaluateCondition(condition);
}

/**
 * Convenience function to evaluate a plain condition string against a data record.
 * Supports both template expressions (e.g., '${data.amount > 1000}') and
 * plain expressions (e.g., "status == 'overdue'").
 * Record fields are available both directly (status) and namespaced (data.status).
 */
export function evaluatePlainCondition(
  condition: string,
  record: Record<string, any>
): boolean {
  const evaluator = new ExpressionEvaluator({ ...record, data: record }, globalCache, globalFormulas);
  try {
    const isTemplate = /\$\{/.test(condition);
    const result = isTemplate
      ? evaluator.evaluate(condition, { throwOnError: true })
      : evaluator.evaluateExpression(condition);
    return result === true;
  } catch {
    return false;
  }
}
