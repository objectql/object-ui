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
  /** Field to filter on */
  field: string;
  /**
   * Filter operator. The set is closed: a rule whose operator is outside it
   * (possible for a rule read back from stored JSON, which the type does not
   * guard) evaluates to `false` and denies the row.
   */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains';
  /** Filter value */
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
        const fieldValue = row[filter.field];
        return evaluateFilter(fieldValue, filter.operator, filter.value);
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
      return fieldValue > filterValue;
    case 'lt':
      return fieldValue < filterValue;
    case 'gte':
      return fieldValue >= filterValue;
    case 'lte':
      return fieldValue <= filterValue;
    case 'in':
      return Array.isArray(filterValue) && filterValue.includes(fieldValue);
    case 'nin':
      return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(String(filterValue));
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
