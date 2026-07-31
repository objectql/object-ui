/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Filter Converter Utilities
 * 
 * Shared utilities for converting MongoDB-like filter operators
 * to ObjectStack FilterNode AST format.
 */

/**
 * FilterNode AST type definition
 * Represents a filter condition or a logical combination of conditions
 * 
 * @example
 * // Simple condition
 * ['status', '=', 'active']
 * 
 * // Logical combination
 * ['and', ['age', '>=', 18], ['status', '=', 'active']]
 */
export type FilterNode = 
  | [string, string, any]  // [field, operator, value]
  | [string, ...FilterNode[]];  // [logic, ...conditions]

/**
 * Map MongoDB-like operators to ObjectStack filter operators.
 * 
 * @param operator - MongoDB-style operator (e.g., '$gte', '$in')
 * @returns ObjectStack operator or null if not recognized
 */
export function convertOperatorToAST(operator: string): string | null {
  // Spec reference: framework/packages/spec/src/data/filter.zod.ts
  // Canonical MongoDB-style keys are camelCase ($startsWith, $endsWith, $notContains).
  // Lowercase aliases are accepted for tolerance.
  const operatorMap: Record<string, string> = {
    '$eq': '=',
    '$ne': '!=',
    '$gt': '>',
    '$gte': '>=',
    '$lt': '<',
    '$lte': '<=',
    '$in': 'in',
    '$nin': 'nin',
    '$notin': 'nin',
    '$between': 'between',
    '$contains': 'contains',
    '$notContains': 'notcontains',
    '$notcontains': 'notcontains',
    '$startsWith': 'startswith',
    '$startswith': 'startswith',
    '$endsWith': 'endswith',
    '$endswith': 'endswith',
  };
  
  return operatorMap[operator] || null;
}

/**
 * Convert object-based filters to ObjectStack FilterNode AST format.
 * Converts MongoDB-like operators to ObjectStack filter expressions.
 * 
 * @param filter - Object-based filter with optional operators
 * @returns FilterNode AST array
 * 
 * @example
 * // Simple filter - converted to AST
 * convertFiltersToAST({ status: 'active' })
 * // => ['status', '=', 'active']
 * 
 * @example
 * // Complex filter with operators
 * convertFiltersToAST({ age: { $gte: 18 } })
 * // => ['age', '>=', 18]
 * 
 * @example
 * // Multiple conditions
 * convertFiltersToAST({ age: { $gte: 18, $lte: 65 }, status: 'active' })
 * // => ['and', ['age', '>=', 18], ['age', '<=', 65], ['status', '=', 'active']]
 * 
 * @throws {Error} If an unknown operator is encountered
 */
export function convertFiltersToAST(filter: Record<string, any>): FilterNode | Record<string, any> {
  const conditions: FilterNode[] = [];
  
  for (const [field, value] of Object.entries(filter)) {
    if (value === null || value === undefined) continue;
    
    // Check if value is a complex operator object
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle operator-based filters
      for (const [operator, operatorValue] of Object.entries(value)) {
        // Special handling for $regex - warn users about limited support
        if (operator === '$regex') {
          console.warn(
            `[ObjectUI] Warning: $regex operator is not fully supported. ` +
            `Converting to 'contains' which only supports substring matching, not regex patterns. ` +
            `Field: '${field}', Value: ${JSON.stringify(operatorValue)}. ` +
            `Consider using $contains or $startsWith instead.`
          );
          conditions.push([field, 'contains', operatorValue]);
          continue;
        }

        // $null / $exists translate based on their boolean value (per spec semantics).
        // $null: true  → IS NULL    | $null: false  → IS NOT NULL
        // $exists: true → IS NOT NULL | $exists: false → IS NULL
        if (operator === '$null') {
          conditions.push([field, operatorValue ? 'is_null' : 'is_not_null', true]);
          continue;
        }
        if (operator === '$exists') {
          conditions.push([field, operatorValue ? 'is_not_null' : 'is_null', true]);
          continue;
        }

        const astOperator = convertOperatorToAST(operator);
        
        if (astOperator) {
          conditions.push([field, astOperator, operatorValue]);
        } else {
          // Unknown operator - throw error to avoid silent failure
          throw new Error(
            `[ObjectUI] Unknown filter operator '${operator}' for field '${field}'. ` +
            `Supported operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $between, ` +
            `$contains, $notContains, $startsWith, $endsWith, $null, $exists. ` +
            `If you need exact object matching, use the value directly without an operator.`
          );
        }
      }
    } else {
      // Simple equality filter
      conditions.push([field, '=', value]);
    }
  }
  
  // If no conditions, return original filter
  if (conditions.length === 0) {
    return filter;
  }
  
  // If only one condition, return it directly
  if (conditions.length === 1) {
    return conditions[0];
  }
  
  // Multiple conditions: combine with 'and'
  return ['and', ...conditions];
}

/**
 * Normalize ONE filter source into a single filter node.
 *
 * A "source" is whatever a view hands a renderer, and there are three shapes in
 * circulation, all legitimate:
 *
 *   - `[{ field, operator, value }, ...]`  a spec `ViewFilterRule[]`
 *   - `[['stage', '=', 'won'], ...]`       an AST node / legacy flat array
 *   - `{ status: 'active' }`               a MongoDB-style object
 *
 * The third is the one that kept getting lost. Renderers tested `source.length
 * > 0` before using it, which is `undefined > 0` for an object — so a
 * `table.defaultFilters` (declared `Record<string, any>`) was DROPPED and the
 * view returned every record. Silently: no error, just a wider answer.
 *
 * Returns `undefined` for an absent or empty source, so callers can skip
 * `$filter` rather than sending an empty array.
 */
export function toFilterNode(source: unknown): FilterNode | Record<string, any> | undefined {
  if (source === null || source === undefined) return undefined;
  if (Array.isArray(source)) return source.length > 0 ? (source as FilterNode) : undefined;
  if (typeof source !== 'object') return undefined;
  const obj = source as Record<string, any>;
  if (Object.keys(obj).length === 0) return undefined;
  // MongoDB-style → AST, so it can sit beside the other shapes under one `and`.
  return convertFiltersToAST(obj);
}

/**
 * Combine filter sources under a single `and`, each as its OWN child.
 *
 * Wrapping rather than spreading, on purpose. `['and', ...rules]` looks
 * equivalent and is not: spreading a `ViewFilterRule[]` puts bare rule OBJECTS
 * where the AST expects nodes, and the server neither understands nor rejects
 * that cleanly — `isFilterAST` says no (a 400 since objectstack#4121), while
 * `parseFilterAST` reads the rule as a Mongo condition and filters on columns
 * literally named `field` / `operator` / `value`. Spreading is only correct
 * when the source happens to be an array of nodes, which is why it survived.
 *
 * Sources that normalize to nothing are skipped; one surviving source is
 * returned as-is rather than wrapped in a pointless `and`.
 */
export function mergeFilterNodes(
  ...sources: unknown[]
): FilterNode | Record<string, any> | undefined {
  const nodes = sources.map(toFilterNode).filter((n) => n !== undefined);
  if (nodes.length === 0) return undefined;
  if (nodes.length === 1) return nodes[0];
  return ['and', ...nodes] as FilterNode;
}
