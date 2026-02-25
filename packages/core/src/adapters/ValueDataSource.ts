/**
 * ObjectUI — ValueDataSource
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * A DataSource adapter for the `provider: 'value'` ViewData mode.
 * Operates entirely on an in-memory array — no network requests.
 */

import type {
  DataSource,
  QueryParams,
  QueryResult,
  AggregateParams,
  AggregateResult,
} from '@object-ui/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ValueDataSourceConfig<T = any> {
  /** The static data array */
  items: T[];
  /** Optional ID field name for findOne/update/delete (defaults to '_id' then 'id') */
  idField?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the ID of a record given possible field names */
function getRecordId(record: any, idField?: string): string | number | undefined {
  if (idField) return record[idField];
  return record._id ?? record.id;
}

/**
 * Evaluate an AST-format filter node against a record.
 * Supports conditions like ['field', 'op', value] and logical
 * combinations like ['and', ...conditions] or ['or', ...conditions].
 */
function matchesASTFilter(record: any, filterNode: any[]): boolean {
  if (!filterNode || filterNode.length === 0) return true;

  const head = filterNode[0];

  // Logical operators: ['and', ...conditions] or ['or', ...conditions]
  if (head === 'and') {
    return filterNode.slice(1).every((sub: any) => matchesASTFilter(record, sub));
  }
  if (head === 'or') {
    return filterNode.slice(1).some((sub: any) => matchesASTFilter(record, sub));
  }

  // Condition node: [field, operator, value]
  if (filterNode.length === 3 && typeof head === 'string') {
    const [field, operator, target] = filterNode;
    const value = record[field];

    switch (operator) {
      case '=':
        return value === target;
      case '!=':
        return value !== target;
      case '>':
        return value > target;
      case '>=':
        return value >= target;
      case '<':
        return value < target;
      case '<=':
        return value <= target;
      case 'in':
        return Array.isArray(target) && target.includes(value);
      case 'not in':
      case 'notin': // alias used by convertFiltersToAST
        return Array.isArray(target) && !target.includes(value);
      case 'contains': {
        const lv = typeof value === 'string' ? value.toLowerCase() : '';
        return typeof value === 'string' && lv.includes(String(target).toLowerCase());
      }
      case 'notcontains': {
        const lv = typeof value === 'string' ? value.toLowerCase() : '';
        return typeof value === 'string' && !lv.includes(String(target).toLowerCase());
      }
      case 'startswith': {
        const lv = typeof value === 'string' ? value.toLowerCase() : '';
        return typeof value === 'string' && lv.startsWith(String(target).toLowerCase());
      }
      case 'between':
        return Array.isArray(target) && target.length === 2 && value >= target[0] && value <= target[1];
      default:
        return true;
    }
  }

  return true;
}

/**
 * Simple in-memory filter evaluation.
 * Supports flat key-value equality and basic operators ($gt, $gte, $lt, $lte, $ne, $in).
 */
function matchesFilter(record: any, filter: Record<string, any>): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    const value = record[key];

    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      // Operator-based filter
      for (const [op, target] of Object.entries(condition)) {
        switch (op) {
          case '$gt':
            if (!(value > (target as any))) return false;
            break;
          case '$gte':
            if (!(value >= (target as any))) return false;
            break;
          case '$lt':
            if (!(value < (target as any))) return false;
            break;
          case '$lte':
            if (!(value <= (target as any))) return false;
            break;
          case '$ne':
            if (value === target) return false;
            break;
          case '$in':
            if (!Array.isArray(target) || !target.includes(value)) return false;
            break;
          case '$contains':
            if (typeof value !== 'string' || !value.toLowerCase().includes(String(target).toLowerCase())) return false;
            break;
          default:
            break;
        }
      }
    } else {
      // Simple equality
      if (value !== condition) return false;
    }
  }
  return true;
}

/** Apply sort ordering to an array (returns a new sorted array) */
function applySort<T>(
  data: T[],
  orderby?: QueryParams['$orderby'],
): T[] {
  if (!orderby) return data;

  // Normalize to array of { field, order }
  let sorts: Array<{ field: string; order: 'asc' | 'desc' }> = [];

  if (Array.isArray(orderby)) {
    sorts = orderby.map((item) => {
      if (typeof item === 'string') {
        if (item.startsWith('-')) {
          return { field: item.slice(1), order: 'desc' as const };
        }
        return { field: item, order: 'asc' as const };
      }
      return { field: item.field, order: (item.order ?? 'asc') as 'asc' | 'desc' };
    });
  } else if (typeof orderby === 'object') {
    sorts = Object.entries(orderby).map(([field, order]) => ({
      field,
      order: order as 'asc' | 'desc',
    }));
  }

  if (sorts.length === 0) return data;

  return [...data].sort((a: any, b: any) => {
    for (const { field, order } of sorts) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      if (av == null) return order === 'asc' ? -1 : 1;
      if (bv == null) return order === 'asc' ? 1 : -1;
      const cmp = av < bv ? -1 : 1;
      return order === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/** Pick specific fields from a record */
function selectFields<T>(record: T, fields?: string[]): T {
  if (!fields || fields.length === 0) return record;
  const out: any = {};
  for (const f of fields) {
    if (f in (record as any)) {
      out[f] = (record as any)[f];
    }
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// ValueDataSource
// ---------------------------------------------------------------------------

/**
 * ValueDataSource — an in-memory DataSource backed by a static array.
 *
 * Used when `ViewData.provider === 'value'`. All operations are synchronous
 * (but wrapped in Promises to satisfy the DataSource interface). Supports
 * basic filter, sort, pagination, and CRUD operations.
 *
 * @example
 * ```ts
 * const ds = new ValueDataSource({
 *   items: [
 *     { id: '1', name: 'Alice', age: 30 },
 *     { id: '2', name: 'Bob', age: 25 },
 *   ],
 * });
 *
 * const result = await ds.find('users', { $filter: { age: { $gt: 26 } } });
 * // result.data === [{ id: '1', name: 'Alice', age: 30 }]
 * ```
 */
export class ValueDataSource<T = any> implements DataSource<T> {
  private items: T[];
  private idField: string | undefined;

  constructor(config: ValueDataSourceConfig<T>) {
    // Deep clone to prevent external mutation
    this.items = JSON.parse(JSON.stringify(config.items));
    this.idField = config.idField;
  }

  // -----------------------------------------------------------------------
  // DataSource interface
  // -----------------------------------------------------------------------

  async find(_resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    let result = [...this.items];

    // Filter — support both MongoDB-style objects and AST-format arrays
    if (params?.$filter) {
      if (Array.isArray(params.$filter) && params.$filter.length > 0) {
        result = result.filter((r) => matchesASTFilter(r, params.$filter as any[]));
      } else if (!Array.isArray(params.$filter) && Object.keys(params.$filter).length > 0) {
        result = result.filter((r) => matchesFilter(r, params.$filter!));
      }
    }

    // Search (simple text search across all string fields)
    if (params?.$search) {
      const q = params.$search.toLowerCase();
      result = result.filter((r) =>
        Object.values(r as any).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(q),
        ),
      );
    }

    const totalCount = result.length;

    // Sort
    result = applySort(result, params?.$orderby);

    // Pagination
    const skip = params?.$skip ?? 0;
    const top = params?.$top;
    if (skip > 0) result = result.slice(skip);
    if (top !== undefined) result = result.slice(0, top);

    // Select
    if (params?.$select?.length) {
      result = result.map((r) => selectFields(r, params.$select));
    }

    return {
      data: result,
      total: totalCount,
      hasMore: skip + (top ?? result.length) < totalCount,
    };
  }

  async findOne(
    _resource: string,
    id: string | number,
    params?: QueryParams,
  ): Promise<T | null> {
    const record = this.items.find(
      (r) => String(getRecordId(r, this.idField)) === String(id),
    );
    if (!record) return null;

    if (params?.$select?.length) {
      return selectFields(record, params.$select);
    }
    return { ...record };
  }

  async create(_resource: string, data: Partial<T>): Promise<T> {
    const record = { ...data } as T;
    // Auto-generate an ID if missing
    if (!getRecordId(record, this.idField)) {
      const field = this.idField ?? '_id';
      (record as any)[field] = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    this.items.push(record);
    return { ...record };
  }

  async update(
    _resource: string,
    id: string | number,
    data: Partial<T>,
  ): Promise<T> {
    const index = this.items.findIndex(
      (r) => String(getRecordId(r, this.idField)) === String(id),
    );
    if (index === -1) {
      throw new Error(`ValueDataSource: Record with id "${id}" not found`);
    }
    this.items[index] = { ...this.items[index], ...data };
    return { ...this.items[index] };
  }

  async delete(_resource: string, id: string | number): Promise<boolean> {
    const index = this.items.findIndex(
      (r) => String(getRecordId(r, this.idField)) === String(id),
    );
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  async bulk(
    _resource: string,
    operation: 'create' | 'update' | 'delete',
    data: Partial<T>[],
  ): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) {
      switch (operation) {
        case 'create':
          results.push(await this.create(_resource, item));
          break;
        case 'update': {
          const id = getRecordId(item, this.idField);
          if (id !== undefined) {
            results.push(await this.update(_resource, id, item));
          }
          break;
        }
        case 'delete': {
          const id = getRecordId(item, this.idField);
          if (id !== undefined) {
            await this.delete(_resource, id);
          }
          break;
        }
      }
    }
    return results;
  }

  async getObjectSchema(_objectName: string): Promise<any> {
    // Infer a minimal schema from the first item
    if (this.items.length === 0) return { name: _objectName, fields: {} };

    const sample = this.items[0];
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(sample as any)) {
      fields[key] = { type: typeof value };
    }
    return { name: _objectName, fields };
  }

  async getView(_objectName: string, _viewId: string): Promise<any | null> {
    return null;
  }

  async getApp(_appId: string): Promise<any | null> {
    return null;
  }

  async aggregate(_resource: string, params: AggregateParams): Promise<AggregateResult[]> {
    const { field, function: aggFn, groupBy } = params;
    const groups: Record<string, any[]> = {};

    for (const record of this.items as any[]) {
      const key = String(record[groupBy] ?? 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }

    return Object.entries(groups).map(([key, group]) => {
      const values = group.map(r => Number(r[field]) || 0);
      let result: number;

      switch (aggFn) {
        case 'count':
          result = group.length;
          break;
        case 'avg':
          result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'min':
          result = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          result = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'sum':
        default:
          result = values.reduce((a, b) => a + b, 0);
          break;
      }

      return { [groupBy]: key, [field]: result };
    });
  }

  // -----------------------------------------------------------------------
  // Extra utilities
  // -----------------------------------------------------------------------

  /** Get the current number of items */
  get count(): number {
    return this.items.length;
  }

  /** Get a snapshot of all items (cloned) */
  getAll(): T[] {
    return JSON.parse(JSON.stringify(this.items));
  }
}
