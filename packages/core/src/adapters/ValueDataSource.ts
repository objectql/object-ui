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
import {
  asciiCaseInsensitiveContains,
  canonicalAstOperator,
  RETIRED_FILTER_OPERATORS,
} from '@objectstack/spec/data';
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
    // -- Text operators. THE DIRECTION, so the next reader does not take it for
    // a typo and fold it back (objectui#7379): the `$contains` FAMILY is
    // case-SENSITIVE and `icontains` is its one case-insensitive member. That
    // is the platform's ruling (objectstack#4706 Q2 = A), not this file's
    // preference, and it is what every backend executes — `driver-sql`,
    // `driver-sqlite-wasm`, `driver-turso`, `driver-mongodb` and
    // `driver-memory` all import `FILTER_TEXT_CASES` (`@objectstack/spec/data`)
    // and answer its `$contains is case-SENSITIVE` rows. These four arms used
    // to lower-case BOTH sides, so `contains` executed `icontains`, the two
    // were one predicate, and a `provider: 'value'` list answered a filter with
    // strictly more rows than the same filter run against the wire.
    //
    // There is no `i` twin for the other three: `VALID_AST_OPERATORS` has
    // `icontains` and NOTHING else with an `i` prefix — no `istartswith`, no
    // `iendswith`, no `not_icontains` (the `$` dialect has no `$notIcontains`,
    // and the AST table mirrors the executed set rather than widening it). So
    // case-sensitive is the ONLY reading available to them, and it is the one
    // `$notContains` needs for complementarity: a folding `not_contains` beside
    // a case-exact `contains` lets one row fail an operator AND its negation.
    case 'contains':
      return typeof value === 'string' && value.includes(String(target));
    // The fold is ASCII-ONLY (objectstack#4706 Q1 = A) and it runs on BOTH
    // sides, which is why this borrows the spec's own predicate instead of
    // spelling one here. `String.prototype.toLowerCase()` — what this arm used
    // to reach for — is the FULL Unicode fold, so it matched `CAFÉ` against
    // `café`; three of the five backends are SQLite underneath, whose `lower()`
    // folds ASCII only, so a Unicode promise here is one the wire cannot keep.
    case 'icontains':
      return typeof value === 'string' && asciiCaseInsensitiveContains(value, String(target));
    case 'not_contains':
      return typeof value === 'string' && !value.includes(String(target));
    case 'starts_with':
      return typeof value === 'string' && value.startsWith(String(target));
    case 'ends_with':
      return typeof value === 'string' && value.endsWith(String(target));
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
 * Evaluate ONE `$`-dialect operator against a record's value for a field.
 *
 * The vocabulary is the spec's own `FILTER_OPERATORS` (`@objectstack/spec/data`)
 * and each arm answers the same question its AST twin answers in
 * {@link matchesComparisonNode} — `$eq`/`=`, `$nin`/`nin`, `$startsWith`/
 * `starts_with`, and so on, one-to-one across all sixteen. That pairing IS the
 * fix for objectui#8447: `find()` picks between the two matchers on nothing
 * more than whether `$filter` arrived as an array or an object, so any operator
 * one of them executes and the other waves through is a result that changes
 * with the SHAPE of the filter rather than with its meaning.
 *
 * ## What the `default` arm used to be
 *
 * `default: break` — which adds NO constraint. An operator this switch did not
 * name therefore matched EVERY row, silently, while the array arm of the very
 * same `if` refused the unknown node, excluded the row and logged it
 * (objectui#7349). Measured before the fix: `$nin`, `$startsWith`, `$null` and
 * `$exists` each returned the full set, and so did `$eq` — the most ordinary
 * operator an author can reach for, whose plain-equality sibling
 * (`{ age: 26 }`) was correct all along.
 *
 * The direction of the change is worth stating plainly, because it MOVES
 * RESULTS: a filter that silently selected everything now selects the rows it
 * names, and one this matcher cannot execute selects nothing and says so. Both
 * are louder than what they replace; neither is "match everything", which was
 * nobody's intent.
 *
 * ## What is refused, and why each one
 *
 * - **`$exists`** — refused rather than implemented, and the refusal names the
 *   exact synonym that works. `$exists: true` is `$null: false` and
 *   `$exists: false` is `$null: true` (`convertFiltersToAST`,
 *   `../utils/filter-converter.ts`), so nothing is unreachable through it.
 * - **`$like` / `$ilike`** — declared by `StringOperatorSchema` but deliberately
 *   kept OUT of `FILTER_OPERATORS` while the faces that cannot execute them are
 *   staged in (objectstack#7536). This matcher has no pattern engine, and the
 *   spec's own note says naming them before an arm exists turns a loud refusal
 *   into a dropped predicate — i.e. every row, the defect this file just fixed.
 * - **`$regex` / `$options`** — RETIRED from the protocol (objectstack#4706).
 *   The refusal prints `RETIRED_FILTER_OPERATORS`' prescription verbatim, the
 *   way the five driver-side refusal sites do, so six faces say one thing.
 * - **Anything else**, including a nested relation constraint
 *   (`{ profile: { verified: true } }`), whose keys are field names rather than
 *   operators: this matcher does not descend into relations.
 */
function matchesDollarOperator(
  value: any,
  operator: string,
  target: any,
  field: string,
  refusals: Set<string>,
): boolean {
  switch (operator) {
    case '$eq':
      return value === target;
    case '$ne':
      return value !== target;
    case '$gt':
      return value > target;
    case '$gte':
      return value >= target;
    case '$lt':
      return value < target;
    case '$lte':
      return value <= target;
    case '$in':
      return Array.isArray(target) && target.includes(value);
    case '$nin':
      return Array.isArray(target) && !target.includes(value);
    case '$between':
      return Array.isArray(target) && target.length === 2
        && value >= target[0] && value <= target[1];
    // -- Text operators. Same ruling the AST arms carry (objectstack#4706 Q2):
    // the `$contains` family is case-SENSITIVE and `$icontains` is its one
    // case-insensitive member, folding ASCII only on both sides.
    case '$contains':
      return typeof value === 'string' && value.includes(String(target));
    case '$icontains':
      return typeof value === 'string' && asciiCaseInsensitiveContains(value, String(target));
    case '$notContains':
      return typeof value === 'string' && !value.includes(String(target));
    case '$startsWith':
      return typeof value === 'string' && value.startsWith(String(target));
    case '$endsWith':
      return typeof value === 'string' && value.endsWith(String(target));
    // -- Null-ness. Unlike the AST spelling, direction comes from the VALUE:
    // `$null: true` is IS NULL and `$null: false` is IS NOT NULL, which is the
    // lowering `convertFiltersToAST` already performs.
    case '$null':
      return target
        ? value === null || value === undefined
        : value !== null && value !== undefined;

    case '$exists':
      return refuseFilterNode(
        refusals,
        `filter operator '$exists' on field '${field}' is not executed by the in-memory `
        + `matcher; write { ${field}: { $null: ${target ? 'false' : 'true'} } }, which this `
        + `matcher executes and which the platform lowers $exists to`,
      );

    default: {
      const retired = RETIRED_FILTER_OPERATORS[operator];
      if (retired) {
        return refuseFilterNode(
          refusals,
          `filter operator '${operator}' on field '${field}' is retired. ${retired.why}`,
        );
      }
      if (!operator.startsWith('$')) {
        return refuseFilterNode(
          refusals,
          `filter condition on field '${field}' carries the non-operator key `
          + `'${operator}'; the in-memory matcher does not descend into a nested `
          + `relation constraint`,
        );
      }
      return refuseFilterNode(
        refusals,
        `filter operator '${operator}' on field '${field}' is not implemented by the `
        + `in-memory matcher`,
      );
    }
  }
}

/**
 * In-memory evaluation of an OBJECT-shaped (`$`-dialect) filter.
 *
 * Reads a flat key/value equality (`{ age: 26 }`) or a `FieldOperatorsSchema`
 * condition object (`{ age: { $gte: 25 } }`), one entry per field, ANDed. What
 * it cannot execute it refuses through {@link refuseFilterNode} — excluded and
 * logged once per distinct refusal per `find()` — rather than adding no
 * constraint, which is what its `default: break` used to do (objectui#8447).
 *
 * ## Combinators are refused here, not implemented (objectui#8447, its own case)
 *
 * `$and` / `$or` / `$not` are `LOGICAL_OPERATORS`, not field names, and this
 * matcher has no grouping. They were already excluded-and-silent in two of
 * three cases before this card and fail-OPEN in the third, which is why they
 * get an arm now rather than being swept into the operator fix:
 *
 * - `{ $and: [...] }` / `{ $or: [...] }` carry an ARRAY, so they fell to the
 *   simple-equality branch below (`record['$and'] !== [...]` is always true) and
 *   excluded every row with no diagnostic. The rows do not move; the silence does.
 * - `{ $not: {...} }` carries an OBJECT (`FilterConditionSchema`, not an array),
 *   so it entered the operator branch, its inner FIELD names were read as
 *   operator names, and every one of them hit `default: break`. It therefore
 *   matched EVERY row — the same fail-open direction as the operators, and the
 *   one behaviour here whose result changes.
 *
 * Executing them is a feature with its own semantics to settle (the empty-group
 * identities and `$not`'s NULL-safe rule, objectstack#5146 / #5322), not part of
 * this repair. An author who needs a group today writes the AST array `$filter`,
 * which the sibling arm of `find()` already executes.
 */
function matchesFilter(
  record: any,
  filter: Record<string, any>,
  refusals: Set<string>,
): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      return refuseFilterNode(
        refusals,
        `filter combinator '${key}' is not implemented by the object-dialect matcher; `
        + `express the group as an AST array $filter, which this adapter executes`,
      );
    }

    const value = record[key];

    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      // Operator-based filter — every operator on the field is ANDed.
      for (const [op, target] of Object.entries(condition)) {
        if (!matchesDollarOperator(value, op, target, key, refusals)) return false;
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
      // ONE collector for BOTH arms, drained after the pass: a node either
      // matcher refuses would otherwise log once PER ROW. Shared on purpose —
      // the two arms differ only in the SHAPE of `$filter`, and objectui#8447
      // was exactly the asymmetry of one arm refusing loudly while the other
      // waved everything through in silence.
      const refusals = new Set<string>();
      if (Array.isArray(params.$filter) && params.$filter.length > 0) {
        result = result.filter((r) => matchesASTFilter(r, params.$filter as any[], refusals));
      } else if (!Array.isArray(params.$filter) && Object.keys(params.$filter).length > 0) {
        result = result.filter(
          (r) => matchesFilter(r, params.$filter as Record<string, any>, refusals),
        );
      }
      for (const message of refusals) console.warn(message);
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
