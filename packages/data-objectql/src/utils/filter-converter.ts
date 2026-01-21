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
  const operatorMap: Record<string, string> = {
    '$eq': '=',
    '$ne': '!=',
    '$gt': '>',
    '$gte': '>=',
    '$lt': '<',
    '$lte': '<=',
    '$in': 'in',
    '$nin': 'notin',
    '$notin': 'notin',
    '$contains': 'contains',
    '$startswith': 'startswith',
    '$between': 'between',
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
            `Consider using $contains or $startswith instead.`
          );
          conditions.push([field, 'contains', operatorValue]);
          continue;
        }
        
        const astOperator = convertOperatorToAST(operator);
        
        if (astOperator) {
          conditions.push([field, astOperator, operatorValue]);
        } else {
          // Unknown operator - throw error to avoid silent failure
          throw new Error(
            `[ObjectUI] Unknown filter operator '${operator}' for field '${field}'. ` +
            `Supported operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $contains, $startswith, $between. ` +
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
