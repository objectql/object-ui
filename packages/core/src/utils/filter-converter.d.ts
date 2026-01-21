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
export type FilterNode = [string, string, any] | [string, ...FilterNode[]];
/**
 * Map MongoDB-like operators to ObjectStack filter operators.
 *
 * @param operator - MongoDB-style operator (e.g., '$gte', '$in')
 * @returns ObjectStack operator or null if not recognized
 */
export declare function convertOperatorToAST(operator: string): string | null;
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
export declare function convertFiltersToAST(filter: Record<string, any>): FilterNode | Record<string, any>;
