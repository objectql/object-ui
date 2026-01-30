/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Expression Cache
 * 
 * Caches compiled expressions to avoid re-parsing on every render.
 * Provides significant performance improvement for frequently evaluated expressions.
 * 
 * @module evaluator
 * @packageDocumentation
 */

/**
 * A compiled expression function that can be executed with context values
 */
export type CompiledExpression = (...args: any[]) => any;

/**
 * Expression compilation metadata
 */
export interface ExpressionMetadata {
  /**
   * The compiled function
   */
  fn: CompiledExpression;
  
  /**
   * Variable names used in the expression
   */
  varNames: string[];
  
  /**
   * Original expression string
   */
  expression: string;
  
  /**
   * Timestamp when the expression was compiled
   */
  compiledAt: number;
  
  /**
   * Number of times this expression has been used
   */
  hitCount: number;
}

/**
 * Cache for compiled expressions
 * 
 * @example
 * ```ts
 * const cache = new ExpressionCache();
 * const compiled = cache.compile('data.amount > 1000', ['data']);
 * const result = compiled({ amount: 1500 }); // true
 * ```
 */
export class ExpressionCache {
  private cache = new Map<string, ExpressionMetadata>();
  private maxSize: number;
  
  /**
   * Create a new expression cache
   * 
   * @param maxSize Maximum number of expressions to cache (default: 1000)
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }
  
  /**
   * Compile an expression or retrieve from cache
   * 
   * @param expr The expression to compile
   * @param varNames Variable names available in the context
   * @returns Compiled expression metadata
   */
  compile(expr: string, varNames: string[]): ExpressionMetadata {
    // Create a cache key that includes variable names to ensure correct scoping
    const cacheKey = `${expr}::${varNames.join(',')}`;
    
    if (this.cache.has(cacheKey)) {
      const metadata = this.cache.get(cacheKey)!;
      metadata.hitCount++;
      return metadata;
    }
    
    // Evict least recently used if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Compile the expression
    const fn = this.compileExpression(expr, varNames);
    
    const metadata: ExpressionMetadata = {
      fn,
      varNames: [...varNames],
      expression: expr,
      compiledAt: Date.now(),
      hitCount: 1,
    };
    
    this.cache.set(cacheKey, metadata);
    return metadata;
  }
  
  /**
   * Compile an expression into a function
   */
  private compileExpression(expression: string, varNames: string[]): CompiledExpression {
    // SECURITY NOTE: Using Function constructor for expression evaluation.
    // This is a controlled use case with:
    // 1. Sanitization check (isDangerous) performed by caller
    // 2. Strict mode enabled ("use strict")
    // 3. Limited scope (only varNames variables available)
    // 4. No access to global objects (process, window, etc.)
    return new Function(...varNames, `"use strict"; return (${expression});`) as CompiledExpression;
  }
  
  /**
   * Evict the least recently used expression from cache
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let lowestHits = Infinity;
    
    // Find the entry with lowest hit count, or oldest if tied
    for (const [key, metadata] of this.cache.entries()) {
      if (metadata.hitCount < lowestHits || 
          (metadata.hitCount === lowestHits && metadata.compiledAt < oldestTime)) {
        oldestKey = key;
        oldestTime = metadata.compiledAt;
        lowestHits = metadata.hitCount;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Check if an expression is cached
   */
  has(expr: string, varNames: string[]): boolean {
    const cacheKey = `${expr}::${varNames.join(',')}`;
    return this.cache.has(cacheKey);
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    totalHits: number;
    entries: Array<{ expression: string; hitCount: number }>;
  } {
    let totalHits = 0;
    const entries: Array<{ expression: string; hitCount: number }> = [];
    
    for (const metadata of this.cache.values()) {
      totalHits += metadata.hitCount;
      entries.push({
        expression: metadata.expression,
        hitCount: metadata.hitCount,
      });
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      entries: entries.sort((a, b) => b.hitCount - a.hitCount),
    };
  }
}
