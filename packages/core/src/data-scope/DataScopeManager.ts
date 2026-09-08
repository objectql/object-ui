/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - DataScope Manager
 *
 * Runtime implementation of the DataContext interface for managing
 * named data scopes. Provides row-level data access control and
 * reactive data state management within the UI component tree.
 *
 * @module data-scope
 * @packageDocumentation
 */

import type { DataScope, DataContext, DataSource } from '@object-ui/types';

/**
 * Row-level filter for restricting data access within a scope
 */
export interface RowLevelFilter {
  /**
   * Field to filter on. Read as an OWN member of the record and nothing else:
   * a name that resolves on the prototype chain instead is refused, and the
   * rule denies the row. See `readField`.
   */
  field: string;
  /**
   * Filter operator. The set is closed: a rule whose operator is outside it
   * (possible for a rule read back from stored JSON, which the type does not
   * guard) evaluates to `false` and denies the row.
   */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains';
  /**
   * Filter value. The ordered operators (`gt` / `gte` / `lt` / `lte`) compare
   * it against the field value WITHOUT coercion — both sides must be the same
   * comparable kind or the rule denies the row. See `isOrderedPair`.
   */
  value: any;
}

/**
 * Configuration for creating a data scope
 */
export interface DataScopeConfig {
  /** Data source instance */
  dataSource?: DataSource;
  /** Initial data */
  data?: any;
  /** Row-level filters to apply */
  filters?: RowLevelFilter[];
  /** Whether this scope is read-only */
  readOnly?: boolean;
}

/**
 * DataScopeManager — Runtime implementation of DataContext.
 *
 * Manages named data scopes for the component tree, providing:
 * - Scope registration and lookup
 * - Row-level security via filters
 * - Data state management (data, loading, error)
 *
 * @example
 * ```ts
 * const manager = new DataScopeManager();
 * manager.registerScope('contacts', {
 *   dataSource: myDataSource,
 *   data: [],
 * });
 * const scope = manager.getScope('contacts');
 * ```
 */
export class DataScopeManager implements DataContext {
  scopes: Record<string, DataScope> = {};
  private filters: Record<string, RowLevelFilter[]> = {};
  private readOnlyScopes: Set<string> = new Set();
  private listeners: Map<string, Array<(scope: DataScope) => void>> = new Map();

  /**
   * Register a data scope
   */
  registerScope(name: string, scope: DataScope): void {
    this.scopes[name] = scope;
    this.notifyListeners(name, scope);
  }

  /**
   * Register a data scope with configuration
   */
  registerScopeWithConfig(name: string, config: DataScopeConfig): void {
    const scope: DataScope = {
      dataSource: config.dataSource,
      data: config.data,
      loading: false,
      error: null,
    };

    if (config.filters) {
      this.filters[name] = config.filters;
    }

    if (config.readOnly) {
      this.readOnlyScopes.add(name);
    }

    this.scopes[name] = scope;
    this.notifyListeners(name, scope);
  }

  /**
   * Get a data scope by name
   */
  getScope(name: string): DataScope | undefined {
    return this.scopes[name];
  }

  /**
   * Remove a data scope
   */
  removeScope(name: string): void {
    delete this.scopes[name];
    delete this.filters[name];
    this.readOnlyScopes.delete(name);
    this.listeners.delete(name);
  }

  /**
   * Check if a scope is read-only
   */
  isReadOnly(name: string): boolean {
    return this.readOnlyScopes.has(name);
  }

  /**
   * Get row-level filters for a scope
   */
  getFilters(name: string): RowLevelFilter[] {
    return this.filters[name] || [];
  }

  /**
   * Set row-level filters for a scope
   */
  setFilters(name: string, filters: RowLevelFilter[]): void {
    this.filters[name] = filters;
  }

  /**
   * Apply row-level filters to a dataset
   */
  applyFilters(name: string, data: any[]): any[] {
    const scopeFilters = this.filters[name];
    if (!scopeFilters || scopeFilters.length === 0) {
      return data;
    }

    return data.filter(row => {
      return scopeFilters.every(filter => {
        const read = readField(row, filter.field);
        // Fail closed, on the #7378 principle: a rule this evaluator cannot
        // answer FROM THE RECORD must not admit the row it exists to hide.
        if (!read.readable) return false;
        return evaluateFilter(read.value, filter.operator, filter.value);
      });
    });
  }

  /**
   * Update data in a scope
   */
  updateScopeData(name: string, data: any): void {
    const scope = this.scopes[name];
    if (!scope) return;

    if (this.readOnlyScopes.has(name)) {
      throw new Error(`Cannot update read-only scope: ${name}`);
    }

    scope.data = data;
    this.notifyListeners(name, scope);
  }

  /**
   * Update loading state for a scope
   */
  updateScopeLoading(name: string, loading: boolean): void {
    const scope = this.scopes[name];
    if (!scope) return;

    scope.loading = loading;
    this.notifyListeners(name, scope);
  }

  /**
   * Update error state for a scope
   */
  updateScopeError(name: string, error: Error | string | null): void {
    const scope = this.scopes[name];
    if (!scope) return;

    scope.error = error;
    this.notifyListeners(name, scope);
  }

  /**
   * Subscribe to scope changes
   */
  onScopeChange(name: string, listener: (scope: DataScope) => void): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }
    this.listeners.get(name)!.push(listener);

    return () => {
      const arr = this.listeners.get(name);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /**
   * Get all registered scope names
   */
  getScopeNames(): string[] {
    return Object.keys(this.scopes);
  }

  /**
   * Clear all scopes
   */
  clear(): void {
    this.scopes = {};
    this.filters = {};
    this.readOnlyScopes.clear();
    this.listeners.clear();
  }

  private notifyListeners(name: string, scope: DataScope): void {
    const arr = this.listeners.get(name);
    if (arr) {
      arr.forEach(listener => listener(scope));
    }
  }
}

/**
 * Field names that are never record data, whatever the record looks like.
 *
 * `prototype` earns its place separately from the other two: it is NOT present
 * on a plain object's chain (`'prototype' in {}` is `false`), so the own-member
 * rule below would classify it as an ordinary absent field. Naming it here
 * refuses it outright, the way `evaluateCondition` in `@object-ui/permissions`
 * refuses all three.
 */
const PROTOTYPE_FIELD_NAMES: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * The outcome of reading a rule's field off a record.
 *
 * `readable: false` is not "the value was falsy" — it is "this evaluator
 * refuses to answer this rule from this record", which `applyFilters` turns
 * into a denial.
 */
type FieldRead = { readable: true; value: unknown } | { readable: false };

/**
 * Read a rule's field as an OWN member of the record.
 *
 * Measured on the pre-fix source (objectui#7751): a rule naming a prototype
 * member evaluated against the prototype chain rather than the record, and on
 * a negative operator that admitted EVERY row —
 * `{ field: 'constructor', operator: 'ne', value: 'x' }` returned the whole
 * dataset, silently. A fail-open on a row-level permission boundary.
 *
 * Three cases, and the third is why this is not simply `hasOwnProperty`:
 *
 *   1. A name in `PROTOTYPE_FIELD_NAMES` — refused outright.
 *   2. An own member — its value, which is the only value ever read.
 *   3. Not an own member. Here the record is asked whether the name resolves
 *      on its prototype chain at all:
 *        - it does (`toString`, `valueOf`, an `Object.create` parent's field)
 *          → REFUSED. The value exists but is not this record's data.
 *        - it does not → the field is genuinely absent, and `undefined` is
 *          returned exactly as before, so the ordinary "this row has no
 *          `status`" rules keep the verdicts they have always had.
 *
 * Case 3 is where this went further than the sibling. Reading with
 * `hasOwnProperty` alone collapses "inherited" into "absent", and on a
 * negative operator absent ADMITS: `{ field: 'toString', operator: 'ne' }`
 * admitted every row through `evaluateCondition` in `@object-ui/permissions`
 * — measured — because `toString` was not one of the three names its list
 * refused. objectui#8044 ported this same three-case read there, so the two
 * evaluators now agree. Distinguishing inherited from absent closes the whole
 * class rather than three spellings of it, and it is what keeps this change a
 * NARROWING: collapsing inherited into absent would have flipped
 * inherited-value rows from denied to admitted on `ne` / `nin`.
 *
 * A `null` / `undefined` row still throws from the `hasOwnProperty` call, as
 * the direct `row[field]` access it replaces did.
 */
function readField(row: any, field: string): FieldRead {
  if (PROTOTYPE_FIELD_NAMES.has(field)) return { readable: false };
  if (Object.prototype.hasOwnProperty.call(row, field)) return { readable: true, value: row[field] };
  if (field in Object(row)) return { readable: false };
  return { readable: true, value: undefined };
}

/**
 * Realm-safe `Date` test — `instanceof` answers `false` for a `Date` from
 * another realm (an iframe, a worker, a VM context), and a row-level rule
 * silently denying every row there would be the same class of bug this file
 * keeps paying for.
 */
function isDate(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * May these two values be compared with `<` / `>` without JavaScript coercing
 * one of them?
 *
 * Measured on the pre-fix source (objectui#7751): `{ field: 'age',
 * operator: 'gte', value: 0 }` admitted `null`, `'10'`, `true`, `false`, `''`
 * and `[]` — every one of them by coercion to a number the rule's author never
 * wrote. Requiring the two sides to be the same comparable kind refuses all of
 * them.
 *
 * Same KIND, not "both numbers". `evaluateCondition` in
 * `@object-ui/permissions` requires `typeof === 'number'` on both sides, and
 * copying that line here would deny every row for `{ field: 'created',
 * operator: 'gte', value: '2023-01-01' }` — ISO date strings, plain string
 * ranges and `Date` objects all order correctly on this evaluator today
 * (measured), and none of those comparisons coerces anything. The hazard is
 * cross-kind comparison, so cross-kind is what this refuses; the sibling's
 * extra strictness is not part of the property and it costs real rules.
 */
function isOrderedPair(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return true;
  if (typeof a === 'string' && typeof b === 'string') return true;
  return isDate(a) && isDate(b);
}

/**
 * Evaluate a single filter condition against a field value.
 *
 * An operator the switch does not implement evaluates to `false` (fail
 * closed); see the `default` arm.
 */
function evaluateFilter(fieldValue: any, operator: RowLevelFilter['operator'], filterValue: any): boolean {
  switch (operator) {
    case 'eq':
      return fieldValue === filterValue;
    case 'ne':
      return fieldValue !== filterValue;
    case 'gt':
      return isOrderedPair(fieldValue, filterValue) && fieldValue > filterValue;
    case 'lt':
      return isOrderedPair(fieldValue, filterValue) && fieldValue < filterValue;
    case 'gte':
      return isOrderedPair(fieldValue, filterValue) && fieldValue >= filterValue;
    case 'lte':
      return isOrderedPair(fieldValue, filterValue) && fieldValue <= filterValue;
    case 'in':
      return Array.isArray(filterValue) && filterValue.includes(fieldValue);
    case 'nin':
      return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
    case 'contains':
      // The rule's value is required to BE a string rather than be turned into
      // one: `String(filterValue)` made `{ operator: 'contains', value: 1 }`
      // match the record `'10'`, which is the same unwritten coercion the
      // ordered arms above just stopped doing. `evaluateCondition` in
      // `@object-ui/permissions` already required both sides to be strings.
      return typeof fieldValue === 'string' && typeof filterValue === 'string' && fieldValue.includes(filterValue);
    default:
      // Fail closed. A row-level rule this evaluator cannot answer must not
      // admit the row it exists to hide: the same answer `evaluateCondition`
      // in @object-ui/permissions gives from its own `default` arm, and the
      // opposite of the admit-all this arm used to return. The declared union
      // above keeps TypeScript callers off this arm; a rule read back from
      // stored JSON arrives as a plain string and is not protected by it.
      // Silent, like the sibling: the caller sees a narrower result set, not
      // a thrown error (objectui#7378).
      return false;
  }
}

/**
 * Default DataScopeManager instance
 */
export const defaultDataScopeManager = new DataScopeManager();
