/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * QuickFilter Normalization Utility
 *
 * Adapter layer that converts between two QuickFilter formats:
 * - Spec format:     { field, operator, value }
 * - ObjectUI format: { id, label, filters[], icon?, defaultActive? }
 *
 * Both formats are accepted; spec-format items are auto-converted to ObjectUI format.
 */

/** Normalized ObjectUI QuickFilter shape (output of normalizeQuickFilter) */
export interface NormalizedQuickFilter {
  id: string;
  label: string;
  filters: Array<any[] | string>;
  icon?: string;
  defaultActive?: boolean;
}

/**
 * Map a human-readable / spec operator to the ObjectStack AST operator.
 */
function mapSpecOperator(op: string): string {
  switch (op) {
    case 'equals': case 'eq': return '=';
    case 'notEquals': case 'ne': case 'neq': return '!=';
    case 'contains': return 'contains';
    case 'notContains': return 'notcontains';
    case 'greaterThan': case 'gt': return '>';
    case 'greaterOrEqual': case 'gte': return '>=';
    case 'lessThan': case 'lt': return '<';
    case 'lessOrEqual': case 'lte': return '<=';
    case 'in': return 'in';
    case 'notIn': return 'not in';
    case 'before': return '<';
    case 'after': return '>';
    default: return op;
  }
}

/**
 * Normalize a single QuickFilter item.
 * - If it's already in ObjectUI format (has id + label + filters), return as-is.
 * - If it's in Spec format (has field + operator), convert to ObjectUI format.
 */
export function normalizeQuickFilter(item: any): NormalizedQuickFilter {
  // Already in ObjectUI format
  if (item.id && item.label && Array.isArray(item.filters)) {
    return item as NormalizedQuickFilter;
  }
  // Spec format: { field, operator, value }
  if (item.field && item.operator) {
    const op = mapSpecOperator(item.operator);
    return {
      id: `${item.field}-${item.operator}-${String(item.value ?? '')}`,
      label: item.label || `${item.field} ${item.operator} ${String(item.value ?? '')}`,
      filters: [[item.field, op, item.value]],
      icon: item.icon,
      defaultActive: item.defaultActive,
    };
  }
  // Unknown format — return as-is
  return item;
}

/**
 * Normalize an array of QuickFilter items (mixed formats accepted).
 */
export function normalizeQuickFilters(
  items: any[] | undefined,
): NormalizedQuickFilter[] | undefined {
  if (!items || items.length === 0) return undefined;
  return items.map(normalizeQuickFilter);
}
