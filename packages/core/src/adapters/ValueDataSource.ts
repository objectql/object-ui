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
  BatchTransactionOperation,
  DataSourceMutationEvent,
  QueryParams,
  QueryResult,
  AggregateParams,
  AggregateResult,
} from '@object-ui/types';
import { canonicalAstOperator } from '@objectstack/spec/data';
import { emulateBatchTransaction } from './batchTransaction.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ValueDataSourceConfig<T = any> {
  /** The static data array */
  items: T[];
  /** Optional ID field name for findOne/update/delete (defaults to 'id' then '_id') */
  idField?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the ID of a record given possible field names */
function getRecordId(record: any, idField?: string): string | number | undefined {
  if (idField) return record[idField];
  return record.id ?? record._id;
}

/**
 * A filter node this matcher cannot execute.
 *
 * Recorded and EXCLUDING, never silently ignored. Answering `true` for a node
 * the matcher does not understand is how a filtered list came back UNFILTERED —
 * every row, no error, not one console line (objectui#7349). The measured
 * sibling behaviour is a refusal, not a pass: `evaluateCondition`
 * (`@object-ui/permissions`) returns `false` from its `default` arm, and
 * `ReportViewer`'s formatting switch leaves `match` false. The wire-side
 * sibling `@object-ui/data-objectstack` goes further and THROWS
 * (`MalformedFilterError`), on the stated ground that dropping one entry of an
 * `and` WIDENS the result set — but it is deciding whether to send a query at
 * all, while this matcher is deciding about a single row. So the row is
 * excluded and the reason is logged once per distinct refusal per `find()`,
 * which keeps a 10k-row scan to one line.
 */
function refuseFilterNode(refusals: Set<string>, reason: string): false {
  refusals.add(`[ObjectUI] ValueDataSource: ${reason}. Rows are excluded rather than passed through.`);
  return false;
}

/**
 * Evaluate ONE comparison node — `[field, operator]` or `[field, operator, value]`.
 *
 * The operator is canonicalized through the spec's own
 * {@link canonicalAstOperator}, so this switch has ONE arm per operator rather
 * than one per spelling, and the accepted vocabulary is the published one
 * rather than a second hand-written list that drifts from it. That matters here
 * more than it reads: `viewFilterRuleToNode` (`../utils/filter-converter.ts`)
 * lowers a stored view's rules through the spec's `normalizeFilterOperator`,
 * so what actually arrives is the CANONICAL VIEW spelling — `equals`,
 * `greater_than`, `starts_with` — and 16 of the 20 `VIEW_FILTER_OPERATORS`
 * had no arm in the old spelling-keyed switch. Every one of them reached its
 * `default: return true` and selected every row.
 */
function matchesComparisonNode(
  record: any,
  node: any[],
  refusals: Set<string>,
): boolean {
  const field = node[0] as string;
  const rawOperator = node[1] as string;
  // `'not in'` (with a space) is NOT a member of the spec's
  // `VALID_AST_OPERATORS` — the wire would refuse it — but this matcher has
  // always implemented it and a test pins it. Canonicalizing it here keeps the
  // refusal arm below from deleting support that exists today; whether to
  // retire the spelling is a separate question from this card's.
  const operator =
    rawOperator === 'not in' ? 'nin' : canonicalAstOperator(rawOperator);
  const value = record[field];
  const target = node[2];

  switch (operator) {
    // -- Null-ness. Direction comes from the operator NAME; the value slot is
    // never read, so the 2-tuple `['x', 'is_not_null']` and the 3-tuple
    // `['x', 'isnotnull', null]` are the same predicate. `canonicalAstOperator`
    // folds all eight spellings (`is_null` / `isnull` / `is_empty` / `isempty`
    // and their four negatives) onto these two arms — including `is_empty`,
    // which the spec lowers to `$null` rather than to an emptiness test.
    case 'is_null':
      return value === null || value === undefined;
    case 'is_not_null':
      return value !== null && value !== undefined;

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
    case 'nin':
      return Array.isArray(target) && !target.includes(value);
    case 'contains':
    case 'icontains': {
      const lv = typeof value === 'string' ? value.toLowerCase() : '';
      return typeof value === 'string' && lv.includes(String(target).toLowerCase());
    }
    case 'not_contains': {
      const lv = typeof value === 'string' ? value.toLowerCase() : '';
      return typeof value === 'string' && !lv.includes(String(target).toLowerCase());
    }
    case 'starts_with': {
      const lv = typeof value === 'string' ? value.toLowerCase() : '';
      return typeof value === 'string' && lv.startsWith(String(target).toLowerCase());
    }
    case 'ends_with': {
      const lv = typeof value === 'string' ? value.toLowerCase() : '';
      return typeof value === 'string' && lv.endsWith(String(target).toLowerCase());
    }
    case 'between':
      return Array.isArray(target) && target.length === 2 && value >= target[0] && value <= target[1];

    default:
      // Includes the spec-valid `like` / `ilike`: they carry pattern semantics
      // this in-memory matcher does not implement, and no producer in this repo
      // emits them into a filter. Refusing is the loud answer; matching every
      // row was the silent one.
      return refuseFilterNode(
        refusals,
        `filter operator '${String(rawOperator)}' is not implemented by the in-memory matcher`,
      );
  }
}

/**
 * Evaluate an AST-format filter node against a record.
 *
 * Reads the four shapes the spec's `FilterArraySchema` declares and
 * `isFilterAST` accepts, so this consumer applies the same filter the wire
 * would (objectui#7349):
 *
 *   - `['and' | 'or', ...children]`  a logical group
 *   - `[field, operator, value]`     a comparison
 *   - `[field, operator]`            a comparison whose operator needs no value
 *   - `[[…], […]]`                   a legacy flat list of conditions, implicit AND
 *
 * The last one is the shape this matcher used to ignore ENTIRELY, at top level
 * and as a child of `and` / `or` alike — and it is what `mergeFilterNodes`
 * returns for a lone surviving filter source, i.e. the common case. A flat
 * array is unambiguous: the spec's `FilterArrayFieldSchema` forbids `and` / `or`
 * as field names, so a node whose head is itself an array can only be a list.
 *
 * Anything else is refused rather than passed. An empty array stays "no
 * filter" — the spec says the same, and `find()` never calls with one.
 */
function matchesASTFilter(record: any, filterNode: any, refusals: Set<string>): boolean {
  if (!Array.isArray(filterNode)) {
    return refuseFilterNode(
      refusals,
      `filter node ${JSON.stringify(filterNode) ?? String(filterNode)} is not an array`,
    );
  }
  if (filterNode.length === 0) return true;

  const head = filterNode[0];

  // Logical group. `length >= 2` mirrors `isFilterAST`: the keyword opens a
  // group and a group needs at least one condition.
  if (typeof head === 'string') {
    const keyword = head.toLowerCase();
    if (keyword === 'and' || keyword === 'or') {
      if (filterNode.length < 2) {
        return refuseFilterNode(refusals, `'${keyword}' group carries no conditions`);
      }
      const children = filterNode.slice(1);
      return keyword === 'and'
        ? children.every((sub: any) => matchesASTFilter(record, sub, refusals))
        : children.some((sub: any) => matchesASTFilter(record, sub, refusals));
    }
  }

  // Legacy flat list of conditions — implicit AND, the way the server reads it.
  if (Array.isArray(head)) {
    return filterNode.every((sub: any) => matchesASTFilter(record, sub, refusals));
  }

  // Comparison node, 2- or 3-element.
  if (typeof head === 'string' && typeof filterNode[1] === 'string' && filterNode.length <= 3) {
    return matchesComparisonNode(record, filterNode, refusals);
  }

  return refuseFilterNode(
    refusals,
    `filter node ${JSON.stringify(filterNode)} is not a shape the matcher reads`,
  );
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
  private mutationListeners = new Set<(event: DataSourceMutationEvent<T>) => void>();

  constructor(config: ValueDataSourceConfig<T>) {
    // Deep clone to prevent external mutation
    this.items = JSON.parse(JSON.stringify(config.items));
    this.idField = config.idField;
  }

  /** Notify all mutation subscribers */
  private emitMutation(event: DataSourceMutationEvent<T>): void {
    for (const listener of this.mutationListeners) {
      try { listener(event); } catch (err) { console.warn('ValueDataSource: mutation listener error', err); }
    }
  }

  // -----------------------------------------------------------------------
  // DataSource interface
  // -----------------------------------------------------------------------

  async find(_resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    let result = [...this.items];

    // Filter — support both MongoDB-style objects and AST-format arrays
    if (params?.$filter) {
      if (Array.isArray(params.$filter) && params.$filter.length > 0) {
        // One collector per `find()`, drained after the pass: a node the matcher
        // refuses would otherwise log once PER ROW.
        const refusals = new Set<string>();
        result = result.filter((r) => matchesASTFilter(r, params.$filter as any[], refusals));
        for (const message of refusals) console.warn(message);
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
      const field = this.idField ?? 'id';
      (record as any)[field] = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    this.items.push(record);
    this.emitMutation({ type: 'create', resource: _resource, record: { ...record } });
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
    this.emitMutation({ type: 'update', resource: _resource, id, record: { ...this.items[index] } });
    return { ...this.items[index] };
  }

  async delete(_resource: string, id: string | number): Promise<boolean> {
    const index = this.items.findIndex(
      (r) => String(getRecordId(r, this.idField)) === String(id),
    );
    if (index === -1) return false;
    this.items.splice(index, 1);
    this.emitMutation({ type: 'delete', resource: _resource, id });
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

  /**
   * Client-side (non-atomic) cross-object batch — this in-memory adapter has
   * no server transaction, so it delegates to the shared emulation. Per-op
   * MutationEvents come from the `create`/`update`/`delete` primitives above.
   */
  batchTransaction(
    operations: BatchTransactionOperation[],
  ): Promise<{ results: any[] }> {
    return emulateBatchTransaction(this, operations);
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
  // Mutation subscription (P2 — Event Bus)
  // -----------------------------------------------------------------------

  onMutation(callback: (event: DataSourceMutationEvent<T>) => void): () => void {
    this.mutationListeners.add(callback);
    return () => { this.mutationListeners.delete(callback); };
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
