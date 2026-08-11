/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ObjectStackClient, type QueryOptions as ObjectStackQueryOptions } from '@objectstack/client';
import type { DroppedFieldsEvent } from '@objectstack/spec/data';
// #4237 — the metadata save door's advisory reader, shared with `MetadataClient`
// rather than forked. ONE reader, two call sites: the other client class calls it
// from `MetadataClient.save` (#4133/#4236), this one from the interceptor below.
import {
  readSaveAdvisories,
  type MetadataSaveAdvisoryEvent,
  type MetadataSaveAdvisoryListener,
} from './metadata-client';
import type { AnalyticsResult, DatasetSelection } from '@objectstack/spec/contracts';
import type {
  DataSource,
  BatchTransactionOperation,
  DataSourceMutationEvent,
  QueryParams,
  QueryResult,
  GlobalSearchResult,
  GlobalSearchHit,
  FileUploadResult,
  ExportDownloadRequest,
  ImportRequestOptions,
  ImportRecordsResult,
  CreateImportJobResult,
  ImportJobProgressInfo,
  ImportJobResultsInfo,
  ImportJobSummaryInfo,
  ImportJobUndoResult,
  ListImportJobsOptions,
} from '@object-ui/types';
import { errorCodeIsAnyOf } from '@object-ui/types';
import {
  convertFiltersToAST,
  emulateBatchTransaction,
  normalizeSchemaReferenceKeys,
  type DatasetDrillRange,
} from '@object-ui/core';
import { MetadataCache } from './cache/MetadataCache';
import { MetadataClient } from './metadata-client';
import {
  ObjectStackError,
  MetadataNotFoundError,
  BulkOperationError,
  ConnectionError,
  DataApiValidationError,
  createErrorFromResponse,
} from './errors';

/**
 * Map human-readable filter operator names produced by SDUI view configs
 * (e.g. `lead.view.ts`) to the canonical operator symbols expected by the
 * ObjectStack server's filter AST. Unknown operators fall through unchanged
 * so existing AST-style entries keep working.
 *
 * Every VALUE here must be a member of the spec's `VALID_AST_OPERATORS`
 * (`@objectstack/spec/data`) — that set gates `isFilterAST()`, and a filter it
 * rejects is not converted, not validated, and then silently DROPPED by
 * driver-sql (objectstack#3948). Pinned by `filter-operator-ast-parity.test.ts`.
 *
 * Exported for that test. @internal
 */
export const FILTER_OPERATOR_ALIASES: Record<string, string> = {
  equals: '=',
  eq: '=',
  '==': '=',
  not_equals: '!=',
  notequals: '!=',
  ne: '!=',
  greater_than: '>',
  greaterthan: '>',
  gt: '>',
  greater_than_or_equal: '>=',
  greater_than_or_equals: '>=',
  greaterthanorequal: '>=',
  gte: '>=',
  less_than: '<',
  lessthan: '<',
  lt: '<',
  less_than_or_equal: '<=',
  less_than_or_equals: '<=',
  lessthanorequal: '<=',
  lte: '<=',
  in: 'in',
  not_in: 'nin',
  notin: 'nin',
  nin: 'nin',
  contains: 'contains',
  not_contains: 'notcontains',
  notcontains: 'notcontains',
  starts_with: 'startswith',
  startswith: 'startswith',
  ends_with: 'endswith',
  endswith: 'endswith',
  between: 'between',
  is_null: 'isnull',
  isnull: 'isnull',
  is_not_null: 'isnotnull',
  isnotnull: 'isnotnull',
  // Date comparisons. `before`/`after` are CANONICAL members of the spec's
  // `VIEW_FILTER_OPERATORS` (ui/view.zod.ts), so a stored view legitimately
  // carries them — but they are absent from `VALID_AST_OPERATORS`
  // (data/filter.zod.ts), which gates `isFilterAST()`. Without these two
  // entries they reached the wire unchanged, the server's AST gate rejected
  // the shape, and driver-sql skipped the filter ENTIRELY — an unfiltered
  // result set with no error anywhere. objectstack#3948.
  before: '<',
  after: '>',
};

function normalizeFilterOperator(op: unknown): string | null {
  if (typeof op !== 'string') return null;
  const lower = op.toLowerCase();
  return FILTER_OPERATOR_ALIASES[lower] ?? FILTER_OPERATOR_ALIASES[op] ?? op;
}

/**
 * A filter entry this adapter cannot translate into an AST tuple.
 *
 * Thrown rather than skipped. Dropping one entry out of an `and` WIDENS the
 * result set, and dropping the last one emits no `filter=` at all — every row,
 * no error, from a query that asked for a subset. That is the same silent
 * over-fetch the server-side drivers stopped doing in objectstack#3948, and
 * skipping it here just moves it one layer up.
 *
 * Carries the code and status the data API uses for its own version of this
 * refusal (objectstack#4121) so a failed list renders "this view's filter is
 * malformed" rather than "check your connection" (#3066).
 */
export class MalformedFilterError extends Error {
  readonly code = 'INVALID_FILTER';
  readonly httpStatus = 400;
  readonly entry: unknown;
  readonly index: number;
  constructor(entry: unknown, index: number) {
    const shown = JSON.stringify(entry) ?? String(entry);
    super(
      `Filter entry ${index} is not a usable filter rule (${shown}). `
      + 'Expected { field, operator, value } with a non-empty field.',
    );
    this.name = 'MalformedFilterError';
    this.entry = entry;
    this.index = index;
  }
}

/** Detect the malformed-filter refusal, whether raised here or by the server. */
export function isMalformedFilterError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return e.code === 'INVALID_FILTER' || e.name === 'MalformedFilterError';
}

function objectFilterEntryToAST(entry: any): [string, string, any] | null {
  if (!entry || typeof entry !== 'object') return null;
  // `field` only. A `?? entry.name` fallback lived here from the day the
  // function was written (4b93db4e6) and was unreachable for exactly as long:
  // the shape sniff below has always keyed on `field`, so a `name`-keyed entry
  // fell through to the "already AST" branch and shipped raw. The spec agrees
  // it is not a real shape — `ViewFilterRuleSchema.field` is required, so a
  // `name`-keyed rule cannot be saved as view metadata in the first place.
  const field = entry.field;
  const rawOp = entry.operator ?? entry.op ?? '=';
  const op = normalizeFilterOperator(rawOp);
  if (!field || !op) return null;
  return [String(field), op, entry.value];
}

/**
 * Which of the two array filter shapes is this — object entries or an AST node?
 *
 * One definition on purpose. This test used to be written out twice (here and
 * inline in `convertQueryParams`) and the copies had already drifted: the
 * inline one omitted the `!== null` guard, so a `$filter` of `[null]` threw a
 * TypeError on the plain `find()` path while the same value was handled on the
 * `$expand` path. Same stored view, different answer, decided by whether it
 * happened to expand a lookup.
 */
function isObjectFilterEntryForm(filter: readonly unknown[]): boolean {
  const first = filter[0];
  return filter.length > 0
    && typeof first === 'object'
    && first !== null
    && !Array.isArray(first)
    && (first as any).field !== undefined;
}

/**
 * Translate `[{ field, operator, value }, ...]` into a filter AST node. Every
 * entry must translate; see `MalformedFilterError` for why one that doesn't is
 * an error rather than an omission.
 */
function objectFilterEntriesToAST(entries: readonly unknown[]): unknown[] {
  const nodes = entries.map((entry, i) => {
    // An entry that is itself an array is already a node — a mixed array keeps
    // both conditions instead of losing one to a drop or the whole query to an
    // error.
    if (Array.isArray(entry)) return translateFilterChild(entry);
    const tuple = objectFilterEntryToAST(entry);
    if (!tuple) throw new MalformedFilterError(entry, i);
    return tuple;
  });
  return nodes.length === 1 ? (nodes[0] as unknown[]) : ['and', ...nodes];
}

/** Logical heads `parseFilterAST` recognizes (`data/filter.zod.ts`). No `not`. */
const LOGICAL_AST_HEADS = new Set(['and', 'or']);

/**
 * Translate a filter array at EVERY level, not just the top one.
 *
 * Translating only the top level left the commonest composite filter there is
 * shipping raw. A list whose view carries a stored filter and whose user adds
 * one in the panel produces `['and', <ViewFilterRule[]>, <AST tuples>]`; the
 * head is the string `and`, so the old top-level-only check called the whole
 * thing "already AST" and sent the rules on untouched.
 *
 * What the server does with that depends on its version, and both answers are
 * wrong:
 *
 * ```
 * const n = ['and', [{ field: 'stage', operator: 'eq', value: 'won' }], [['amount', '>', 1]]];
 * isFilterAST(n)    // false — a bare rule object is not an AST child
 * parseFilterAST(n) // { amount: { $gt: 1 } }   ← `stage = won` is simply GONE
 * ```
 *
 * Since objectstack#4121 the `isFilterAST` gate turns that into a 400 and the
 * list fails to load. Before it — or anywhere `parseFilterAST` is reached
 * without the gate — the view's own condition is dropped without a word and the
 * list shows records the view exists to exclude.
 */
function translateFilterArray(filter: unknown[]): unknown[] {
  if (isObjectFilterEntryForm(filter)) return objectFilterEntriesToAST(filter);
  const head = filter[0];
  if (typeof head === 'string' && LOGICAL_AST_HEADS.has(head.toLowerCase())) {
    return [head, ...filter.slice(1).map(translateFilterChild)];
  }
  // Legacy flat array of child nodes: [[...], [...]] — implicit AND.
  if (filter.every((child) => Array.isArray(child))) return filter.map(translateFilterChild);
  // A comparison tuple, or a shape we do not recognize. Leave it alone; the
  // server decides, and since objectstack#4121 it says so with a 400.
  return filter;
}

/**
 * A child of a logical node: another array node, a bare rule object, or a value
 * we leave alone.
 *
 * The bare-rule case comes from producers that SPREAD a `ViewFilterRule[]` into
 * an `and` (`['and', ...rules, ...tuples]`) instead of wrapping it. That puts
 * rule objects where the AST expects nodes, and the server has no good answer:
 * `isFilterAST` rejects it (a 400 since objectstack#4121), while
 * `parseFilterAST` reads the rule as a MongoDB condition and filters on columns
 * literally named `field` / `operator` / `value` — three columns that do not
 * exist, so the honest-looking result is empty.
 *
 * Only rule-SHAPED objects are translated: a child with no `field` is a genuine
 * MongoDB condition (`{ status: 'active' }`) and must pass through untouched.
 * Same discriminator `isObjectFilterEntryForm` uses at the top level.
 */
function translateFilterChild(child: unknown): unknown {
  if (Array.isArray(child)) return child.length > 0 ? translateFilterArray(child) : child;
  if (child && typeof child === 'object' && (child as any).field !== undefined) {
    const tuple = objectFilterEntryToAST(child);
    if (tuple) return tuple;
  }
  return child;
}

/**
 * Translate any of the filter shapes accepted by ObjectUI into the AST format
 * understood by the ObjectStack server's `parseFilterAST()`.
 *
 * Accepted inputs:
 *   - `[{ field, operator, value }, ...]` — ViewFilterRule[] from view configs
 *   - `[field, op, value]`                — single AST tuple (passed through)
 *   - `['and'|'or', ...children]`         — logical AST node (passed through)
 *   - `[[...], [...]]`                    — legacy nested AST (passed through)
 *   - `{ field: value }` / `{ field: { $op: value } }` — MongoDB-style object
 *
 * Returns `undefined` when the input is empty/unrecognized so callers can
 * skip emitting `?filter=` entirely.
 */
function translateFilterToAST(filter: unknown): unknown | undefined {
  if (filter === undefined || filter === null) return undefined;

  if (Array.isArray(filter)) {
    if (filter.length === 0) return undefined;
    return translateFilterArray(filter);
  }

  if (typeof filter === 'object') {
    if (Object.keys(filter as Record<string, unknown>).length === 0) return undefined;
    // Same conversion `convertQueryParams` applies. This branch used to return
    // the object VERBATIM, so the two `find()` routes disagreed about the same
    // filter — decided, as ever, by whether the query happened to expand a
    // lookup. Measured across 21 operator shapes, four diverged; the one that
    // mattered is that `convertFiltersToAST`'s unknown-operator guard — added
    // expressly "to avoid silent failure" — never ran on this route, so a typo'd
    // operator threw on a plain read and shipped silently on an expanded one.
    return convertFiltersToAST(filter as Record<string, unknown>);
  }

  return undefined;
}

/**
 * Serialize a `$orderby` to the server's `sort` shorthand
 * (`field,-other_field`), for every shape `QueryParams['$orderby']` declares.
 *
 * The type declares four — `string`, `string[]`, `SortNode[]`,
 * `Record<field, direction>` — and the two `find()` routes each open-coded a
 * fold that handled three of them. The missing one was the bare string, and it
 * did not degrade quietly: `Object.entries('name asc')` enumerates a string's
 * character indices, so the request went out as `sort=0,1,2,3,4,5,6,7`. Against
 * a server that rejects an unreadable sort rather than ignoring it
 * (objectstack#4226), that is a `400 INVALID_SORT` and an empty list — so a
 * standalone `ObjectGrid` with a `sort` in its metadata, which is exactly the
 * shape it builds (`ObjectGrid.tsx`: `` `${field} ${order}` ``), failed to load
 * at all.
 *
 * One serializer for both routes, for the reason the filter path already has
 * one: two copies of a fold can only agree by inspection, and these two did not.
 *
 * Returns `undefined` when nothing is sortable, so callers skip the parameter
 * entirely rather than sending an empty one.
 */
export function serializeOrderBy(orderby: QueryParams['$orderby']): string | undefined {
  if (orderby === undefined || orderby === null) return undefined;

  // `field asc` / `-field` / a comma-separated list of either — already the
  // wire shorthand the server parses, so it rides through untouched.
  if (typeof orderby === 'string') {
    const trimmed = orderby.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const shorthand = (field: string, order?: unknown) =>
    String(order).toLowerCase() === 'desc' ? `-${field}` : field;

  if (Array.isArray(orderby)) {
    const parts = orderby
      .map((item) => (typeof item === 'string' ? item.trim() : shorthand(item.field, item.order)))
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts.join(',') : undefined;
  }

  if (typeof orderby === 'object') {
    const parts = Object.entries(orderby).map(([field, order]) => shorthand(field, order));
    return parts.length > 0 ? parts.join(',') : undefined;
  }

  return undefined;
}

// Module-level discovery cache. Multiple ObjectStackAdapter instances pointed
// at the same baseUrl (e.g. ConditionalAuthWrapper's throwaway adapter +
// AdapterProvider's main adapter) would otherwise each fire `/discovery`. By
// keying on baseUrl we collapse them to a single network round trip per origin.
const discoveryCache = new Map<string, Promise<unknown>>();

/**
 * Fetch the server `discovery` document once per (baseUrl) and reuse the
 * resulting Promise. Used by `ObjectStackAdapter.connect()` (and any caller
 * that wants the discovery payload without spinning up a new client).
 */
export async function getSharedDiscovery(
  baseUrl: string,
  fetcher: () => Promise<unknown>,
): Promise<unknown> {
  const key = baseUrl || '<default>';
  const cached = discoveryCache.get(key);
  if (cached) return cached;
  const p = fetcher().catch((err) => {
    // Allow retry on failure
    discoveryCache.delete(key);
    throw err;
  });
  discoveryCache.set(key, p);
  return p;
}

/** Test/dev helper to drop the cache (e.g. on logout or origin change). */
export function clearSharedDiscoveryCache(): void {
  discoveryCache.clear();
}

/**
 * Read the cross-object atomic-batch capability from a `discovery` document
 * (framework #3298 / objectui #2693). The server advertises it hierarchically
 * under `capabilities.transactionalBatch.enabled`; the published
 * `@objectstack/client` also accepts the flat `capabilities.transactionalBatch:
 * boolean` form and normalizes the two — mirror that here so the adapter reads
 * the same bit regardless of which shape reaches it.
 *
 * Returns:
 *   - `true`  — the backend GUARANTEES an atomic `/batch` (declared === enforced,
 *     i.e. the route is mounted AND the runtime can honour a transaction): the
 *     client may drop its non-atomic fallback and treat any batch failure as a
 *     real error.
 *   - `false` — the backend explicitly does NOT (route absent, or a runtime that
 *     can't open a transaction).
 *   - `undefined` — the capability is absent, i.e. the backend predates #3298;
 *     the caller must keep the legacy runtime-probe fallback (we can't tell
 *     whether `/batch` exists without trying it).
 */
export function readTransactionalBatchCapability(
  discovery: unknown,
): boolean | undefined {
  const caps = (discovery as { capabilities?: unknown } | null | undefined)?.capabilities;
  if (!caps || typeof caps !== 'object') return undefined;
  const value = (caps as Record<string, unknown>).transactionalBatch;
  // Flat form: `{ transactionalBatch: true }`.
  if (typeof value === 'boolean') return value;
  // Hierarchical form: `{ transactionalBatch: { enabled: true } }`.
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { enabled?: unknown }).enabled === 'boolean'
  ) {
    return (value as { enabled: boolean }).enabled;
  }
  return undefined;
}

/**
 * Detect "missing resource" errors regardless of where they originate.
 *
 * The ObjectStack client decorates thrown errors with `httpStatus` (and a
 * machine-readable `code` such as `object_not_found`/`record_not_found`),
 * while raw `fetch()` callers may surface `status` or `statusCode`. Treat
 * any of these as a 404 so callers can degrade gracefully instead of
 * tripping on the property-name mismatch.
 */
export function is404Error(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  if (err.httpStatus === 404 || err.status === 404 || err.statusCode === 404) {
    return true;
  }
  const code = typeof err.code === 'string' ? err.code : '';
  return errorCodeIsAnyOf({ code }, ['OBJECT_NOT_FOUND', 'RECORD_NOT_FOUND']);
}

/**
 * Thrown when the deployment has no analytics capability installed
 * (framework#3891 / #4019).
 *
 * The framework retired its degraded in-kernel analytics fallback — it dropped
 * the caller's RLS/tenant scope and ignored the contract filter, so it answered
 * 200 with over-broad numbers. `@objectstack/service-analytics` is now the
 * domain's only implementation, and a deployment without it answers:
 *
 *   - `POST /api/v1/analytics/query` → **404** (the routes aren't even mounted);
 *   - `POST /api/v1/analytics/dataset/query` → **501 NOT_IMPLEMENTED**.
 *
 * Neither is a bug to report as a stack trace: it is a deployment that hasn't
 * installed the capability. This error carries a message a UI can show as-is.
 */
export class AnalyticsNotInstalledError extends Error {
  readonly code = 'ANALYTICS_NOT_INSTALLED';
  /** The surface that was unavailable, for the message a host renders. */
  readonly surface: string;
  constructor(surface: string, detail?: string) {
    super(
      `Analytics capability is not installed on this deployment — ${surface} is unavailable. ` +
      'Install @objectstack/service-analytics and mount AnalyticsServicePlugin to enable it.' +
      (detail ? ` (server said: ${detail})` : ''),
    );
    this.name = 'AnalyticsNotInstalledError';
    this.surface = surface;
  }
}

/** True when `error` is an {@link AnalyticsNotInstalledError} (or its wire twin). */
export function isAnalyticsNotInstalledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'ANALYTICS_NOT_INSTALLED';
}

/**
 * Thrown when the server REJECTED the analytics query body (HTTP 400 —
 * `VALIDATION_FAILED` since framework#4010 validates `/analytics/query` at the
 * entry against the canonical bare `AnalyticsQuery` shape).
 *
 * Distinct from {@link AnalyticsNotInstalledError} on purpose: this one is a
 * defect in what WE sent, so it must never be answered with the client-side
 * fallback. Numbers produced by a different code path would look plausible and
 * bury the contract violation — the misdirection framework#3878 documented.
 */
export class AnalyticsQueryRejectedError extends Error {
  readonly code = 'ANALYTICS_QUERY_REJECTED';
  /** The server's own error code (e.g. `VALIDATION_FAILED`), when it sent one. */
  readonly serverCode?: string;
  constructor(detail?: string, serverCode?: string) {
    super(
      `Analytics rejected the query: ${detail ?? 'the request body does not match the AnalyticsQuery contract'}`,
    );
    this.name = 'AnalyticsQueryRejectedError';
    this.serverCode = serverCode;
  }
}

/**
 * Classify a FAILED analytics call so the caller knows whether to degrade or
 * to surface the failure.
 *
 * `@objectstack/client`'s fetch wrapper throws on a non-2xx, decorating the
 * error with the semantic `code` string and the numeric `httpStatus` (the
 * ADR-0112 / framework#3842 shape this repo already reads elsewhere). Two
 * outcomes must NOT be conflated:
 *
 *   - **`not-installed`** — the deployment has no analytics service. Since
 *     framework#3891 retired the degraded in-kernel shim, that is a 404 (the
 *     routes aren't mounted at all, framework#4019) or a 501 `NOT_IMPLEMENTED`
 *     (REST's dataset route with no service behind it). Degrading to a
 *     client-side aggregate over a scoped `find()` is CORRECT here.
 *   - **`rejected`** — the server refused OUR body (400 `VALIDATION_FAILED`;
 *     framework#4010 validates `/analytics/query` at the entry). Degrading
 *     would answer our own contract violation with plausible numbers from a
 *     different code path and bury it — the misdirection framework#3878
 *     documented. It must be surfaced.
 *
 * Anything else (5xx, network) is `unknown`: degrade, but silently — it is a
 * transient failure, not a deployment that is missing a capability.
 */
export function classifyAnalyticsFailure(
  error: unknown,
): { kind: 'not-installed' | 'rejected' | 'unknown'; code?: string; message?: string } {
  const err = (error ?? {}) as Record<string, unknown>;
  const code = typeof err.code === 'string' ? err.code : undefined;
  const message = typeof err.message === 'string' ? err.message : undefined;
  const status =
    typeof err.httpStatus === 'number' ? err.httpStatus
    : typeof err.status === 'number' ? err.status
    : typeof err.statusCode === 'number' ? err.statusCode
    : undefined;

  if (code === 'VALIDATION_FAILED' || status === 400) return { kind: 'rejected', code, message };
  if (status === 404 || status === 501 || code === 'NOT_IMPLEMENTED' || code === 'ROUTE_NOT_FOUND') {
    return { kind: 'not-installed', code, message };
  }
  return { kind: 'unknown', code, message };
}

/**
 * Thrown by `update()` / `delete()` when the server returns
 * `409 CONCURRENT_UPDATE` — i.e. the record was modified by someone else
 * between when the caller last read it and when they attempted to write.
 *
 * The error carries the current server-side `updated_at` version and the
 * full latest record so the UI can render an informed conflict-resolution
 * dialog (typically "Reload latest" / "Overwrite anyway" / "Cancel").
 *
 * Mirrors the {@link ConcurrentUpdateError} thrown by
 * `@objectstack/objectql`'s protocol; the wire shape is:
 * ```json
 * { "code": "CONCURRENT_UPDATE",
 *   "error": "<message>",
 *   "currentVersion": "<updated_at>",
 *   "currentRecord": { ...latest... } }
 * ```
 */
export class ConcurrentUpdateError extends Error {
  readonly code = 'CONCURRENT_UPDATE';
  readonly httpStatus = 409;
  readonly currentVersion: string | null;
  readonly currentRecord: unknown;
  constructor(opts: { currentVersion: string | null; currentRecord: unknown; message?: string }) {
    super(opts.message ?? 'Record was modified by another user');
    this.name = 'ConcurrentUpdateError';
    this.currentVersion = opts.currentVersion;
    this.currentRecord = opts.currentRecord;
  }
}

/**
 * Detect "concurrent update" errors raised by the platform. The wire
 * shape is `409` + `code: 'CONCURRENT_UPDATE'`. The client surfaces
 * extra details on `error.details` (full response body).
 */
export function isConcurrentUpdateError(error: unknown): error is ConcurrentUpdateError {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return e.code === 'CONCURRENT_UPDATE' || e.name === 'ConcurrentUpdateError';
}

/**
 * Convert any error thrown by the upstream client into a typed error when we
 * recognise its shape. Returns the original error untouched otherwise, so
 * callers can simply `throw normaliseClientError(err)` from their catch blocks.
 *
 * Two shapes are recognised:
 *   - `409` + `CONCURRENT_UPDATE` → {@link ConcurrentUpdateError};
 *   - `400` + `VALIDATION_FAILED` → {@link DataApiValidationError}, carrying the
 *     server's per-field entries so a form can mark the offending inputs
 *     instead of showing one undirected toast.
 */
export function normaliseClientError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;
  const e = error as Record<string, unknown>;
  // The client sets `details` to the parsed body's `details`, falling back to
  // the WHOLE body — and the validation envelope has no `details` key, so this
  // is where `fields[]` lands.
  const details = (e.details ?? {}) as Record<string, unknown>;

  if (e.code === 'VALIDATION_FAILED' || e.name === 'ValidationError') {
    const rawFields = Array.isArray(details.fields)
      ? details.fields
      : Array.isArray((e as { fields?: unknown }).fields)
        ? ((e as { fields: unknown[] }).fields)
        : [];
    const validationErrors = rawFields
      .map((f) => {
        const rec = (f ?? {}) as Record<string, unknown>;
        const field = typeof rec.field === 'string' ? rec.field : undefined;
        if (!field) return null;
        const message =
          typeof rec.message === 'string' && rec.message.trim()
            ? rec.message
            : typeof rec.code === 'string'
              ? rec.code
              : '';
        return { field, message };
      })
      .filter((x): x is { field: string; message: string } => x !== null);

    return new DataApiValidationError(
      typeof e.message === 'string' ? e.message : 'Validation failed',
      validationErrors[0]?.field,
      validationErrors,
      { fields: rawFields },
    );
  }

  if (e.code !== 'CONCURRENT_UPDATE' && e.httpStatus !== 409) return error;
  if (e.code !== 'CONCURRENT_UPDATE') return error;
  return new ConcurrentUpdateError({
    currentVersion: typeof details.currentVersion === 'string' ? details.currentVersion : null,
    currentRecord: details.currentRecord ?? null,
    message: typeof e.message === 'string' ? e.message : undefined,
  });
}

/**
 * Fold an @objectstack/client HTTP-failure `meta` bag into the log MESSAGE.
 *
 * The client already hands us everything worth knowing —
 * `logger.error("HTTP request failed", undefined, { method, url, status, error })`
 * — but it hands it as the THIRD argument. Everything that flattens a console
 * record to text (a headless/CDP console capture, a log shipper, a copied
 * DevTools line) keeps only the message and renders the rest as `[object
 * Object]` / `Object`, so a wall of failures carried no method, no URL and no
 * status: the reporter of objectui#4042 had to diff the network panel by hand
 * to find out that 30 red lines were all one benign pre-login burst.
 *
 * So the identifying fields go into the string itself, and the structured bag
 * is STILL passed alongside for DevTools to expand — text for the flatteners,
 * object for the inspectors, neither at the other's expense.
 *
 * Exported for tests. Returns `null` when `meta` carries none of the three
 * fields, so callers keep the original message rather than printing a husk.
 */
export function formatHttpFailureMessage(
  message: string,
  meta?: Record<string, any>,
): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const method = typeof meta.method === 'string' && meta.method ? meta.method : undefined;
  const url = typeof meta.url === 'string' && meta.url ? meta.url : undefined;
  const status =
    typeof meta.status === 'number'
      ? meta.status
      : typeof meta.statusCode === 'number'
        ? meta.statusCode
        : undefined;
  if (!method && !url && status === undefined) return null;

  // `code` is the ADR-0112 semantic error code. The client puts the parsed
  // body under `meta.error`; some call sites hoist the code to the top level.
  const errBody = meta.error && typeof meta.error === 'object' ? meta.error : undefined;
  const rawCode =
    (typeof meta.code === 'string' && meta.code) ||
    (errBody && typeof (errBody as Record<string, unknown>).code === 'string'
      ? ((errBody as Record<string, string>).code)
      : undefined);

  const parts = [method ?? 'GET', url ?? '<unknown url>'];
  parts.push(`-> ${status ?? 'no status'}`);
  if (rawCode) parts.push(`[${rawCode}]`);
  return `${message}: ${parts.join(' ')}`;
}

/**
 * Build a Logger compatible with @objectstack/client that (a) spells every
 * request failure out in the message — see {@link formatHttpFailureMessage} —
 * and (b) demotes expected 404 noise to console.debug. The client logs every
 * non-2xx response with
 * `logger.error("HTTP request failed", undefined, { method, url, status, error })`,
 * but 404s on optional collections (sys_presence, sys_activity, …) are part of
 * normal degraded operation when those plugins aren't installed on the
 * server — they should not surface as errors in the browser DevTools.
 *
 * NOTE the asymmetry, and keep it: 404-on-an-optional-collection is demoted
 * because it is an EXPECTED outcome of a request we still mean to make. No
 * other status is demoted — a 401 that survives the console's session gate
 * (objectui#4042: a mid-session expiry, say) is a real event and must stay a
 * visible, fully-identified error. The cure for doomed requests is not issuing
 * them, never hiding them once issued.
 *
 * Returned object is loosely typed because the spec's Logger interface lives
 * in a transitive package; using `any` keeps us decoupled.
 *
 * Exported so the console's log contract is testable, and so an app wiring its
 * own `ObjectStackClient` gets the same identified failures.
 */
export function createQuietHttpLogger(): any {
  const isExpected404 = (meta?: Record<string, any>): boolean => {
    if (!meta || typeof meta !== 'object') return false;
    if (meta.status === 404 || meta.statusCode === 404) return true;
    const errBody = meta.error;
    if (errBody && typeof errBody === 'object') {
      const code = (errBody as Record<string, unknown>).code;
      if (errorCodeIsAnyOf({ code }, ['OBJECT_NOT_FOUND', 'RECORD_NOT_FOUND'])) return true;
    }
    return false;
  };
  const logger: any = {
    debug: (message: string, meta?: Record<string, any>) =>
      console.debug(message, meta ?? ''),
    info: (message: string, meta?: Record<string, any>) =>
      console.info(message, meta ?? ''),
    warn: (message: string, meta?: Record<string, any>) =>
      console.warn(message, meta ?? ''),
    error: (message: string, error?: Error, meta?: Record<string, any>) => {
      if (isExpected404(meta)) {
        console.debug(
          `[ObjectStack] ${formatHttpFailureMessage(message, meta) ?? message} (suppressed expected 404)`,
          meta,
        );
        return;
      }
      console.error(formatHttpFailureMessage(message, meta) ?? message, error ?? '', meta ?? '');
    },
    fatal: (message: string, error?: Error, meta?: Record<string, any>) =>
      console.error(formatHttpFailureMessage(message, meta) ?? message, error ?? '', meta ?? ''),
    log: (message: string, ...args: any[]) => console.log(message, ...args),
    child: () => logger,
    withTrace: () => logger,
  };
  return logger;
}

/**
 * Connection state for monitoring
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Connection state change event
 */
export interface ConnectionStateEvent {
  state: ConnectionState;
  timestamp: number;
  error?: Error;
}

/**
 * Batch operation progress event
 */
export interface BatchProgressEvent {
  operation: 'create' | 'update' | 'delete';
  total: number;
  completed: number;
  failed: number;
  percentage: number;
}

/**
 * Event listener type for connection state changes
 */
export type ConnectionStateListener = (event: ConnectionStateEvent) => void;

/**
 * Event listener type for batch operation progress
 */
export type BatchProgressListener = (event: BatchProgressEvent) => void;

/**
 * One server-reported write-strip: caller-supplied fields the backend LEGALLY
 * removed from a write before persisting (a non-system caller cannot seed a
 * `readonly` field, a `readonlyWhen` predicate locked it, etc.).
 *
 * THE spec type, re-exported (objectui#3160, objectstack#4115 ledger batch 6).
 * Until then this was a hand copy whose comment said it "mirrors the framework
 * `DroppedFieldsEvent` (spec `DroppedFieldsEventSchema`) structurally so we
 * don't pin a client type version", with `reason` widened from the spec's
 * `'readonly' | 'readonly_when'` to bare `string` "for forward-compatibility
 * with reasons added server-side". Both halves of that reasoning are the
 * failure mode this ledger exists to remove: the spec IS the client type
 * version, and a consumer-side widening of a producer's enum is precisely the
 * lenient fallback AGENTS.md #12 bans — it deletes the only compile-time signal
 * that would tell `AdapterProvider`'s toast wording (which branches on
 * `readonly_when`) that a new reason had appeared.
 */
export type { DroppedFieldsEvent };

/**
 * Emitted after a create/update whose response carried `droppedFields`
 * (framework #3431/#3455). The write SUCCEEDED — this is a warning that some
 * supplied fields never landed, so the UI can tell the user rather than let it
 * pass silently. Subscribe via {@link ObjectStackAdapter.onWriteWarning}.
 */
export interface WriteWarningEvent {
  operation: 'create' | 'update';
  resource: string;
  id?: string | number;
  droppedFields: DroppedFieldsEvent[];
}

/** Event listener type for write-warning (dropped-fields) events. */
export type WriteWarningListener = (event: WriteWarningEvent) => void;

// Re-export FileUploadResult from types for consumers
export type { FileUploadResult } from '@object-ui/types';

/**
 * Deterministic JSON.stringify with sorted object keys, used to build cache
 * keys for in-flight request coalescing. Produces identical output for
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` so callers that build params in
 * different orders still hit the same key.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Whether two values are the SAME as far as the wire is concerned — used to
 * tell a write-strip that lost something from one that lost nothing
 * (objectui#3484).
 *
 * Deliberately strict: `1` and `'1'` are NOT the same here. A false "these are
 * equal" silently swallows a warning about a value the user really did lose,
 * which is the worse of the two errors; a false "these differ" only warns
 * about a no-op. `null` and `undefined` both mean "empty" and do match.
 */
function sameWireValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const aEmpty = a === null || a === undefined;
  const bEmpty = b === null || b === undefined;
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  return stableStringify(a) === stableStringify(b);
}

/**
 * Drop the fields whose strip changed nothing — the caller supplied exactly
 * the value the record already holds (objectui#3484).
 *
 * The server is not wrong to report those: the client DID send the key and the
 * engine DID refuse to write it, so `droppedFields` is an accurate account of
 * the request. But "was not saved" is only news when something was actually
 * lost, and the console's edit form used to round-trip the whole record —
 * including fields it had itself rendered as read-only text — so every save of
 * a state-locked record raised a warning listing fields the user never touched
 * and whose values never changed.
 *
 * A field is kept (still warned about) whenever the no-op cannot be PROVEN:
 * the response echoed no record, or that record does not carry the key.
 *
 * Returns entries with empty `fields` removed; an all-no-op event list comes
 * back empty, which suppresses the warning entirely.
 */
function withoutNoOpDrops(
  droppedFields: DroppedFieldsEvent[],
  sent: Record<string, unknown> | undefined | null,
  stored: Record<string, unknown> | undefined | null,
): DroppedFieldsEvent[] {
  if (!sent || !stored || typeof sent !== 'object' || typeof stored !== 'object') {
    return droppedFields;
  }
  const out: DroppedFieldsEvent[] = [];
  for (const e of droppedFields) {
    const kept = e.fields.filter((f) => {
      if (!Object.prototype.hasOwnProperty.call(sent, f)) return true;
      if (!Object.prototype.hasOwnProperty.call(stored, f)) return true;
      return !sameWireValue(
        (sent as Record<string, unknown>)[f],
        (stored as Record<string, unknown>)[f],
      );
    });
    if (kept.length > 0) out.push({ ...e, fields: kept });
  }
  return out;
}

/**
 * Resolve which object a `type='view'` metadata item belongs to.
 *
 * The metadata index is name-only, not field-typed: `GET /api/v1/meta/view`
 * accepts `?package=` and `?preview=draft` and nothing else (measured on
 * framework `packages/rest/src/rest-server.ts` — the `GET /meta/:type`
 * handler — and on `client.meta.getItems(type, { packageId })`). So every
 * reader of the view namespace enumerates `type='view'` once and narrows to
 * one object HERE, client-side.
 *
 * ONE spelling, one place, deliberately: {@link ObjectStackAdapter.listViews}
 * and {@link ObjectStackAdapter.listViewOverrides} read the same rows out of
 * the same namespace, and two private copies of "which object is this?" is a
 * drift waiting to happen — the switcher showing a view whose override the
 * grid cannot find, or the reverse.
 *
 * `object` is the identity field the write path stamps (and that the
 * framework's overlay heals onto identity-less personalization rows —
 * objectstack#2555); `data.object` is the config's data-provider target and
 * `objectName` the legacy artifact spelling.
 */
function viewItemObjectName(item: any): string | undefined {
  // Handle both bare view spec and `{list: {...}}` artifact wrapper
  const spec = item?.list ?? item;
  return spec?.data?.object ?? spec?.object ?? spec?.objectName;
}

/**
 * Unwrap a `?state=draft` view read into its bare body, or `null` when there
 * is nothing pending (#4139).
 *
 * The framework answers draft reads in a `{type, name, item}` envelope while a
 * published read is the bare body — an asymmetry `MetadataClient.getDraft`
 * documents and deliberately preserves. An empty body is normalized to `null`
 * so the caller's "is this view draft-backed?" test is a plain truthiness
 * check. Mirrors app-shell's `unwrapDraftBody` (ADR-0034 seam); the two live
 * apart because the seam sits above this adapter, not beside it.
 */
function unwrapViewDraft(resp: unknown): Record<string, any> | null {
  if (!resp || typeof resp !== 'object') return null;
  const env = resp as Record<string, any>;
  const body = 'item' in env ? env.item : env;
  if (!body || typeof body !== 'object') return null;
  // Same `{list: {...}}` artifact wrapper the published read unwraps.
  const spec = body.list ?? body;
  if (!spec || typeof spec !== 'object') return null;
  return Object.keys(spec).length > 0 ? (spec as Record<string, any>) : null;
}

/**
 * Merge a partial view patch onto the CURRENT view document.
 *
 * ADR-0005 overlay rows store the *full* view document, so a partial update is
 * a read-merge-write cycle and the merge must start from real current state —
 * merging onto `{}` yields a `{label, name, object}` fragment the server
 * rejects (422), which is exactly how a rename used to be lost (#4139).
 *
 * `name` is forced to the URL segment so the row key and `body.name` agree
 * (#2767 P1), and `object` falls back through the two spellings a stored view
 * may carry before defaulting to the caller's object.
 */
function mergeViewPatch(
  current: Record<string, any>,
  partial: Record<string, any>,
  viewName: string,
  objectName: string,
): Record<string, any> {
  return {
    ...current,
    ...partial,
    name: viewName,
    object: current?.object || current?.data?.object || objectName,
  };
}

/**
 * ObjectStack Data Source Adapter
 *
 * Bridges the ObjectStack Client SDK with the ObjectUI DataSource interface.
 * This allows Object UI applications to seamlessly integrate with ObjectStack
 * backends while maintaining the universal DataSource abstraction.
 * 
 * @example
 * ```typescript
 * import { ObjectStackAdapter } from '@object-ui/data-objectstack';
 * 
 * const dataSource = new ObjectStackAdapter({
 *   baseUrl: 'https://api.example.com',
 *   token: 'your-api-token',
 *   autoReconnect: true,
 *   maxReconnectAttempts: 5
 * });
 * 
 * // Monitor connection state
 * dataSource.onConnectionStateChange((event) => {
 *   console.log('Connection state:', event.state);
 * });
 * 
 * const users = await dataSource.find('users', {
 *   $filter: { status: 'active' },
 *   $top: 10
 * });
 * ```
 */
export class ObjectStackAdapter<T = unknown> implements DataSource<T> {
  private client: ObjectStackClient;
  private connected: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private metadataCache: MetadataCache;
  private connectionState: ConnectionState = 'disconnected';
  private connectionStateListeners: ConnectionStateListener[] = [];
  private batchProgressListeners: BatchProgressListener[] = [];
  private autoReconnect: boolean;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private reconnectAttempts: number = 0;
  private baseUrl: string;
  private token?: string;
  /** One "analytics capability is missing" console line per adapter, not per widget. */
  private analyticsCapabilityWarned = false;
  private fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  // In-flight find() requests keyed by resource + serialized params.
  // Coalesces concurrent identical reads (e.g. React StrictMode double-mount,
  // multiple sibling components requesting the same dataset on first paint)
  // into a single network round trip.
  private inflightFinds = new Map<string, Promise<QueryResult<T>>>();
  // Resources that have responded 404 at least once (collection not installed
  // on this backend). Subsequent find() calls short-circuit to an empty result
  // so optional collections like sys_presence don't hammer the server with
  // failing requests on every record open / panel render.
  private missingResources = new Set<string>();
  // Set once the server has told us it can't do a cross-object transactional
  // batch (the client SDK's data.batchTransaction threw HTTP 404/405/501). After
  // that, batchTransaction skips the SDK call and serves every call via the
  // client-side emulation — the non-atomic fallback lives HERE, isolated to the
  // one adapter that has to cope with a backend lacking server atomicity (#2679).
  private batchUnsupported = false;
  // The server's declared cross-object atomic-batch capability, read from
  // discovery at connect() (framework #3298 / objectui #2693). `true` → the
  // backend GUARANTEES an atomic `/batch`, so batchTransaction trusts it and
  // never degrades to the non-atomic emulation (any failure surfaces as a real
  // error). `false` or `undefined` (capability absent → backend predates #3298)
  // → keep the legacy runtime-probe + emulation fallback so a save is still
  // possible; dropping it there would turn "saves, less safe" into "no save
  // path" on older backends (#2679 compatibility constraint).
  private atomicBatchCapability: boolean | undefined;
  // Subscribers registered via onMutation(). Emitted after each successful
  // create/update/delete so data-bound views (ListView, ObjectView, kanban,
  // calendar) auto-refresh — the interface ListView relies on to reflect
  // inline-edit "Save All" writes without a manual reload.
  private mutationListeners = new Set<(event: DataSourceMutationEvent<T>) => void>();

  // Subscribers registered via onWriteWarning(). Emitted after a create/update
  // whose response carried `droppedFields` (framework #3431/#3455) so the app
  // shell can surface a toast instead of the strip passing silently.
  private writeWarningListeners = new Set<WriteWarningListener>();

  // Subscribers registered via onSaveAdvisory(). Emitted after a metadata save
  // through THIS adapter's `ObjectStackClient` whose 200 carried a non-empty
  // `advisories` array (#4237; backend objectstack#7435). Sibling of the set
  // above in every respect except which door produced the event: that one is
  // record CRUD, this one is the metadata save door.
  private saveAdvisoryListeners = new Set<MetadataSaveAdvisoryListener>();

  constructor(config: {
    baseUrl: string;
    token?: string;
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    cache?: {
      maxSize?: number;
      ttl?: number;
    };
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
  }) {
    // Inject a quiet logger that demotes expected 404s ("HTTP request failed"
    // from probing optional collections like sys_presence/sys_activity) to
    // debug() so they don't pollute the browser console. Other log levels are
    // forwarded to the standard console.
    this.client = new ObjectStackClient({ ...config, logger: createQuietHttpLogger() });
    // #4237 — one emitter for every metadata save this adapter's client makes,
    // installed the moment the client exists so no save can precede it.
    this.installSaveAdvisoryInterceptor();
    this.metadataCache = new MetadataCache(config.cache);
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 3;
    this.reconnectDelay = config.reconnectDelay ?? 1000;
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.fetchImpl = config.fetch || globalThis.fetch.bind(globalThis);
  }

  /**
   * Ensure the client is connected to the server.
   * Call this before making requests or it will auto-connect on first request.
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    // Dedupe concurrent connect() calls — without this, every component
    // that mounts on first paint can trigger an independent discovery
    // request before the first one completes.
    if (this.connectPromise) return this.connectPromise;

    this.setConnectionState('connecting');
    this.connectPromise = (async () => {
      try {
        // Use the module-level discovery cache so multiple adapter instances
        // (or React StrictMode double-mounts) at the same baseUrl share a
        // single network round trip. We inject the result into the client's
        // private `discoveryInfo` field to avoid client.connect() re-fetching.
        const baseUrl = this.baseUrl || '';
        const discoveryUrl = baseUrl
          ? `${baseUrl.replace(/\/$/, '')}/api/v1/discovery`
          : '/api/v1/discovery';

        const data = await getSharedDiscovery(baseUrl, async () => {
          const res = await this.fetchImpl(discoveryUrl, {
            method: 'GET',
            headers: this.token
              ? { Authorization: `Bearer ${this.token}` }
              : undefined,
          });
          if (!res.ok) {
            throw new Error(`discovery ${res.status} ${res.statusText}`);
          }
          const body = await res.json();
          return body && typeof body.success === 'boolean' && 'data' in body
            ? body.data
            : body;
        });

        // Prime the underlying client's cached discovery so capability/route
        // helpers continue to work without a redundant fetch.
        (this.client as unknown as { discoveryInfo?: unknown }).discoveryInfo = data;

        // Record the declared cross-object atomic-batch capability (#3298) so
        // batchTransaction can decide declaratively at call time whether it may
        // trust server atomicity instead of runtime-probing 404/405/501.
        this.atomicBatchCapability = readTransactionalBatchCapability(data);

        this.connected = true;
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to ObjectStack server';
        const connectionError = new ConnectionError(
          errorMessage,
          undefined,
          { originalError: error }
        );

        this.setConnectionState('error', connectionError);

        // Attempt auto-reconnect if enabled
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.attemptReconnect();
        } else {
          throw connectionError;
        }
      } finally {
        this.connectPromise = null;
      }
    })();
    return this.connectPromise;
  }

  /**
   * Attempt to reconnect to the server with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');
    
    // Exponential backoff: delay * 2^(attempts-1)
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    this.connected = false;
    await this.connect();
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if the adapter is currently connected
   */
  isConnected(): boolean {
    return this.connected && this.connectionState === 'connected';
  }

  /**
   * Register a listener for connection state changes
   */
  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionStateListeners.indexOf(listener);
      if (index > -1) {
        this.connectionStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register a listener for batch operation progress
   */
  onBatchProgress(listener: BatchProgressListener): () => void {
    this.batchProgressListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.batchProgressListeners.indexOf(listener);
      if (index > -1) {
        this.batchProgressListeners.splice(index, 1);
      }
    };
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState, error?: Error): void {
    this.connectionState = state;
    
    const event: ConnectionStateEvent = {
      state,
      timestamp: Date.now(),
      error,
    };
    
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in connection state listener:', err);
      }
    });
  }

  /**
   * Emit batch progress event to listeners
   */
  private emitBatchProgress(event: BatchProgressEvent): void {
    this.batchProgressListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in batch progress listener:', err);
      }
    });
  }

  /**
   * Find multiple records with query parameters.
   * Converts OData-style params to ObjectStack query options.
   */
  async find(resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    // Short-circuit when this resource has previously responded 404 — the
    // collection isn't installed on this backend. Callers (AppHeader,
    // RecordDetailView, …) treat empty data as "feature unavailable".
    if (this.missingResources.has(resource)) {
      return { data: [], total: 0 } as QueryResult<T>;
    }
    const key = `${resource}::${stableStringify(params)}`;
    const existing = this.inflightFinds.get(key);
    if (existing) return existing;

    const promise = (async () => {
      await this.connect();

      // When $expand is requested, use a raw GET request to the REST API with
      // `populate` as a URL query param. The server's REST plugin routes
      // GET /data/:object to protocol.findData({ object, query: req.query }),
      // which parses `populate` (comma-separated) into an array for lookup expansion.
      // We use a raw request because the client SDK's data.find() QueryOptions
      // interface does not include populate/expand fields.
      if ((params?.$expand && params.$expand.length > 0)
          || (params?.$search != null && String(params.$search).trim() !== '')) {
        // The client SDK's data.find() QueryOptions drops `$search`; route through
        // the raw GET so the term reaches protocol.findData → the metadata-driven
        // search executor (ADR-0061).
        const result = await this.rawFindWithPopulate(resource, params);
        return this.normalizeQueryResult(result, params);
      }

      const queryOptions = this.convertQueryParams(params);
      try {
        const result: unknown = await this.client.data.find<T>(resource, queryOptions);
        return this.normalizeQueryResult(result, params);
      } catch (err) {
        if (is404Error(err)) {
          // Mark the resource so subsequent calls don't repeat the 404.
          this.missingResources.add(resource);
          return { data: [], total: 0 } as QueryResult<T>;
        }
        throw err;
      }
    })();

    this.inflightFinds.set(key, promise);
    // Use `.then(cleanup, cleanup)` instead of `.finally(cleanup)`. `.finally`
    // returns a new chained promise that re-raises the rejection, and because
    // we don't return that chain, Node/browsers see it as an unhandled
    // rejection — flooding DevTools when callers handle the original `promise`
    // via `.catch()` (e.g. AppHeader probing optional sys_presence/sys_activity).
    const cleanup = () => {
      // Only clear if the entry still points at this promise; a later call
      // that started after settle may have already replaced it.
      if (this.inflightFinds.get(key) === promise) {
        this.inflightFinds.delete(key);
      }
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  /**
   * Full-text search across every searchable object in a single round-trip.
   *
   * Hits `GET /api/v1/search?q=`, the platform's global search endpoint served
   * by the registered search service (the pinyin full-text plugin) and backed
   * by `metadata-protocol`'s `searchAll`. Unlike `find(resource, { $search })`
   * — a per-object metadata-driven search (ADR-0061) — this consults the search
   * index and ranks hits across objects, so it surfaces records the per-object
   * fanout misses. Global affordances (⌘K command palette, search page) prefer
   * this path (framework #3371).
   *
   * Returns `{ query, hits }`. A backend without the search plugin installed
   * answers `404`; we treat that as "no global search here" and return an empty
   * hit set so callers can fall back to a per-object fanout rather than surface
   * an error.
   */
  async searchAll(
    query: string,
    options?: { limit?: number; objects?: string[] },
  ): Promise<GlobalSearchResult> {
    const trimmed = (query ?? '').trim();
    if (trimmed === '') return { query: '', hits: [] };

    await this.connect();

    const queryParams = new URLSearchParams();
    queryParams.set('q', trimmed);
    if (options?.limit != null && options.limit > 0) {
      queryParams.set('limit', String(options.limit));
    }
    if (options?.objects && options.objects.length > 0) {
      queryParams.set('objects', options.objects.join(','));
    }

    const baseUrl = (this.baseUrl || '').replace(/\/$/, '');
    // Avoid doubling /api/v1 when baseUrl already carries the version suffix.
    const hasApiVersionSuffix = /\/api\/v\d+$/i.test(baseUrl);
    const searchPath = hasApiVersionSuffix ? '/search' : '/api/v1/search';
    const url = `${baseUrl}${searchPath}?${queryParams.toString()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.fetchImpl(url, { method: 'GET', headers });

    if (!res.ok) {
      // 404 → the search plugin isn't installed on this backend. Degrade to an
      // empty result so the caller can fall back instead of hard-failing.
      if (res.status === 404) return { query: trimmed, hits: [] };
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(
        errorBody?.error?.message || errorBody?.message || res.statusText,
      ) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const body = await res.json();
    // Unwrap the standard `{ success, data }` envelope when present; the search
    // endpoint itself returns `{ query, hits }`.
    const payload =
      body && typeof body === 'object' && typeof body.success === 'boolean' && 'data' in body
        ? body.data
        : body;

    const rawHits: unknown[] = Array.isArray(payload?.hits)
      ? payload.hits
      : Array.isArray(payload)
        ? payload
        : [];

    const hits: GlobalSearchHit[] = [];
    for (const entry of rawHits) {
      if (!entry || typeof entry !== 'object') continue;
      const h = entry as Record<string, any>;
      const object = h.object ?? h.objectName ?? h.object_name;
      const id = h.id ?? h.record?.id ?? h.record?._id;
      if (typeof object !== 'string' || id == null) continue;
      hits.push({
        object,
        id: String(id),
        title: typeof h.title === 'string' ? h.title : undefined,
        snippet: typeof h.snippet === 'string' ? h.snippet : undefined,
        record: h.record && typeof h.record === 'object' ? h.record : undefined,
      });
    }

    return {
      query: typeof payload?.query === 'string' ? payload.query : trimmed,
      hits,
    };
  }

  /**
   * Find a single record by ID.
   */
  async findOne(resource: string, id: string | number, params?: QueryParams): Promise<T | null> {
    await this.connect();

    // When $expand is requested, use a raw GET request with a filter by id
    // and populate. The installed server v3.0.10's getData() does not support
    // expand/populate, so we route through findData which does.
    if (params?.$expand && params.$expand.length > 0) {
      try {
        const findParams: QueryParams = {
          ...params,
          $filter: { id: String(id) },
          $top: 1,
        };
        const result = await this.rawFindWithPopulate(resource, findParams);
        // Handle array responses (some servers return data as flat arrays)
        if (Array.isArray(result)) {
          return result[0] || null;
        }
        const resultObj = result as { records?: T[]; value?: T[] };
        const records = resultObj.records || resultObj.value || [];
        return records[0] || null;
      } catch (error: unknown) {
        if (is404Error(error)) {
          return null;
        }
        // Fall through to direct GET without $expand — some servers don't
        // support the filter+populate API, so gracefully degrade to a
        // simple data.get() call below rather than failing with "Record not found".
      }
    }

    try {
      const result = await this.client.data.get<T>(resource, String(id));
      return result.record;
    } catch (error: unknown) {
      // If record not found, return null instead of throwing
      if (is404Error(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new record.
   */
  /**
   * Notify all mutation subscribers. A throwing listener must not break the
   * mutation or starve the other subscribers, so each is isolated.
   */
  private emitMutation(event: DataSourceMutationEvent<T>): void {
    for (const listener of this.mutationListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('ObjectStackAdapter: mutation listener error', err);
      }
    }
  }

  /**
   * Subscribe to create/update/delete events on any resource. Returns an
   * unsubscribe function. Data-bound views use this to auto-refresh after a
   * mutation (e.g. inline-edit "Save All", which writes through `update` and
   * must repaint the list without a manual reload).
   */
  onMutation(callback: (event: DataSourceMutationEvent<T>) => void): () => void {
    this.mutationListeners.add(callback);
    return () => {
      this.mutationListeners.delete(callback);
    };
  }

  /**
   * Notify all write-warning subscribers. Isolated like {@link emitMutation}: a
   * throwing listener must not break the write or starve the others.
   */
  private emitWriteWarning(event: WriteWarningEvent): void {
    for (const listener of this.writeWarningListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('ObjectStackAdapter: write-warning listener error', err);
      }
    }
  }

  /**
   * Read `droppedFields` off a create/update response (framework #3431/#3455)
   * and, when present, notify write-warning subscribers. Tolerant of a client
   * whose response type predates `droppedFields`: the field is read structurally
   * and validated, so an older client (or a backend that never drops) is a no-op.
   */
  private notifyDroppedFields(
    operation: 'create' | 'update',
    resource: string,
    result: unknown,
    id?: string | number,
    sent?: Record<string, unknown> | null,
  ): void {
    const dropped = (result as { droppedFields?: unknown } | null | undefined)?.droppedFields;
    if (!Array.isArray(dropped) || dropped.length === 0) return;
    const valid = dropped.filter(
      (e): e is DroppedFieldsEvent =>
        !!e && typeof e === 'object' && Array.isArray((e as DroppedFieldsEvent).fields) && (e as DroppedFieldsEvent).fields.length > 0,
    );
    // A strip that changed nothing is not news — see withoutNoOpDrops (#3484).
    const stored = (result as { record?: Record<string, unknown> } | null | undefined)?.record;
    const droppedFields = withoutNoOpDrops(valid, sent, stored);
    if (droppedFields.length === 0) return;
    this.emitWriteWarning({ operation, resource, ...(id !== undefined ? { id } : {}), droppedFields });
  }

  /**
   * Same, for the cross-object transactional batch (framework #3794). Its
   * response hangs the events off a top-level `droppedFields` list, each tagged
   * with the `index` of the operation it came from — `results` entries are bare
   * record echoes with nowhere to hang a per-row list.
   *
   * This is the path that matters most for the warning: `batchTransaction` is
   * how the console's record form saves a master-detail record, so a
   * `readonlyWhen`-locked field edited in that form was stripped server-side
   * while the UI reported a plain success. The operation kind is taken from the
   * originating op so the toast doesn't call an update a create.
   */
  private notifyBatchDroppedFields(
    operations: BatchTransactionOperation[],
    payload: unknown,
  ): void {
    const dropped = (payload as { droppedFields?: unknown } | null | undefined)?.droppedFields;
    if (!Array.isArray(dropped) || dropped.length === 0) return;
    const results = (payload as { results?: unknown[] } | null | undefined)?.results;
    for (const entry of dropped) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as DroppedFieldsEvent & { index?: number };
      if (!Array.isArray(e.fields) || e.fields.length === 0) continue;
      const op = typeof e.index === 'number' ? operations[e.index] : undefined;
      // Same no-op suppression as the single-record path (#3484). The echoed
      // row for the originating op is the "stored" side; when the batch echoed
      // nothing usable, `withoutNoOpDrops` keeps every field.
      const stored =
        typeof e.index === 'number' && Array.isArray(results)
          ? (results[e.index] as Record<string, unknown> | undefined)
          : undefined;
      const [live] = withoutNoOpDrops(
        [{ object: e.object, fields: e.fields, reason: e.reason }],
        op?.data as Record<string, unknown> | undefined,
        stored,
      );
      if (!live) continue;
      // `delete` never drops fields; anything unexpected reads as an update,
      // which is the truthful default for a batch that echoed a strip.
      const operation: 'create' | 'update' = (op?.action ?? 'create') === 'create' ? 'create' : 'update';
      this.emitWriteWarning({
        operation,
        resource: e.object ?? op?.object ?? '',
        ...(op?.id !== undefined && op?.id !== null ? { id: op.id } : {}),
        droppedFields: [live],
      });
    }
  }

  /**
   * Subscribe to write-warning events (a create/update dropped caller-supplied
   * fields — #3431/#3455). Returns an unsubscribe function. The app shell uses
   * this to toast the user; the write itself already succeeded.
   */
  onWriteWarning(callback: WriteWarningListener): () => void {
    this.writeWarningListeners.add(callback);
    return () => {
      this.writeWarningListeners.delete(callback);
    };
  }

  /**
   * Subscribe to metadata save-advisory events — the runtime authoring gate's
   * advisory findings on a save that SUCCEEDED (#4237; backend
   * objectstack#7435). Returns an unsubscribe function.
   *
   * Deliberately the same seam as {@link onWriteWarning} (#3431/#3455), which
   * is what {@link MetadataSaveAdvisoryEvent}'s own declaration already said it
   * was modelled on. It is a SIBLING of that channel rather than a second
   * payload pushed down it: `WriteWarningEvent` is a closed shape whose
   * `droppedFields` is required and means "fields the write legally stripped",
   * so carrying advisories on it would either force every existing
   * `onWriteWarning` consumer to grow a branch or make the event lie about what
   * happened. The seam's SHAPE is what is reused here — a long-lived instance
   * with a `subscribe → unsubscribe` registration that `AdapterProvider` wires
   * once — not its event type.
   *
   * Why here and not on the config, which is how the other client class does it
   * (#4133/#4236): `MetadataClient` is minted per component by
   * `useMetadataClient`, so it has no instance to subscribe to and its sink
   * rides the factory. `ObjectStackAdapter` is the opposite — one long-lived
   * instance per app, already carrying this exact subscription pattern.
   */
  onSaveAdvisory(callback: MetadataSaveAdvisoryListener): () => void {
    this.saveAdvisoryListeners.add(callback);
    return () => {
      this.saveAdvisoryListeners.delete(callback);
    };
  }

  /**
   * Notify all save-advisory subscribers. Isolated exactly like
   * {@link emitWriteWarning}: a throwing listener must neither break the save
   * nor starve the others.
   */
  private emitSaveAdvisory(event: MetadataSaveAdvisoryEvent): void {
    for (const listener of this.saveAdvisoryListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('ObjectStackAdapter: save-advisory listener error', err);
      }
    }
  }

  /**
   * Install the ONE emitter for the metadata save door (#4237).
   *
   * ## Why this seam, and what it covers
   *
   * `ObjectStackClient.meta.saveItem` is the second client class that writes
   * through `PUT /api/v1/meta/:type/:name`, and every one of its callers reaches
   * it through an adapter this class constructed — the four inside this file
   * (`updateViewConfig`, the two view paths, `updateDashboard`) via
   * `this.client`, and every caller outside it via {@link getClient}, which
   * hands back this same instance: `MetadataService` (app-shell, five saves),
   * `useNavigationSync`, and plugin-designer's Create/EditAppPage. Wrapping the
   * method once here therefore covers all of them WITHOUT a per-site edit, which
   * is the whole point — a toast copied into a dozen call sites is the shape
   * #4133 rejected for the other client class and it is no better here.
   *
   * `meta` is an own, writable property assigned per instance in the SDK's
   * constructor (`this.meta = { … }`), and the client this adapter builds is
   * never shared, so the wrap is bounded to an object this adapter owns for its
   * whole lifetime. It is not a prototype or global patch.
   *
   * ## Response shape — measured, not assumed
   *
   * The two client classes' envelopes coincide at the top level, which is what
   * makes `readSaveAdvisories` reusable unchanged across both. `SaveMetaItem-
   * ResponseSchema` puts `advisories` at the body's top level next to
   * `success` / `version` / `seq` / `state`, and the SDK's `unwrapResponse`
   * strips its `{ success, data }` envelope only when the body actually HAS a
   * `data` key — this body does not, so it is returned verbatim. So the same
   * reader that `MetadataClient.save` uses reads this response correctly, and
   * the pins in `onSaveAdvisory.test.ts` drive a real SDK client through a fake
   * `fetch` rather than stubbing `meta`, so that continues to be measured.
   *
   * ## Draft-door honesty (D1)
   *
   * Drafts are NEVER gated: the framework returns at its D1 early-return
   * (`if (args.state !== 'active') return null`) before running a rule, so a
   * draft save produces no findings to withhold. This client class has no draft
   * door at all to worry about — the SDK's `saveItem(type, name, item)` takes no
   * mode and always writes the active door, which is exactly why the gate DOES
   * run for its callers. `mode` on the emitted event is therefore derived from
   * the response's own `state` rather than from a request-side flag that does
   * not exist here: `'draft'` when the server says the row landed as a draft,
   * `'publish'` otherwise. That keeps the event truthful about which door it
   * came through instead of hard-coding one.
   */
  private installSaveAdvisoryInterceptor(): void {
    const meta = this.client.meta;
    const original = meta.saveItem.bind(meta);
    meta.saveItem = async (type: string, name: string, item: any) => {
      const result = await original(type, name, item);
      // Everything below is best-effort by construction: the row is already
      // committed server-side, so nothing the advisory channel does may change
      // what this call returns or whether it throws.
      try {
        const advisories = readSaveAdvisories(result);
        if (advisories.length > 0) {
          this.emitSaveAdvisory({
            type,
            name,
            mode: (result as { state?: string } | null | undefined)?.state === 'draft' ? 'draft' : 'publish',
            advisories,
          });
        }
      } catch (err) {
        /* an advisory must never turn a committed save into a thrown error */
        console.warn('ObjectStackAdapter: save-advisory read error', err);
      }
      return result;
    };
  }

  async create(resource: string, data: Partial<T>): Promise<T> {
    await this.connect();
    try {
      const result = await this.client.data.create<T>(resource, data);
      this.emitMutation({ type: 'create', resource, record: { ...result.record } });
      this.notifyDroppedFields(
        'create',
        resource,
        result,
        (result.record as { id?: string | number } | undefined)?.id,
        data as Record<string, unknown>,
      );
      return result.record;
    } catch (err) {
      // `update` has always normalised; `create` did not, so a rejected insert
      // reached callers as the raw client error — no typed shape to branch on,
      // and its `fields[]` unreachable. A create is the path that most often
      // trips required-field validation, so it needs this more, not less.
      throw normaliseClientError(err);
    }
  }

  /**
   * Update an existing record.
   *
   * Optional `opts.ifMatch` enables Optimistic Concurrency Control: the
   * server compares the supplied token (typically the `updated_at` value
   * the caller previously read) against the record's current version
   * and throws a {@link ConcurrentUpdateError} on mismatch (HTTP 409).
   *
   * Requires `@objectstack/client@>=4.2.0`, which forwards `opts.ifMatch`
   * as an `If-Match` HTTP header.
   */
  async update(
    resource: string,
    id: string | number,
    data: Partial<T>,
    opts?: { ifMatch?: string },
  ): Promise<T> {
    await this.connect();
    try {
      const result = await this.client.data.update<T>(
        resource,
        String(id),
        data,
        opts?.ifMatch ? { ifMatch: opts.ifMatch } : undefined,
      );
      this.emitMutation({ type: 'update', resource, id, record: { ...result.record } });
      this.notifyDroppedFields('update', resource, result, id, data as Record<string, unknown>);
      return result.record;
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /**
   * Delete a record.
   *
   * Optional `opts.ifMatch` enables Optimistic Concurrency Control —
   * see {@link update} for details. On 409 the call rejects with
   * a {@link ConcurrentUpdateError}.
   */
  async delete(
    resource: string,
    id: string | number,
    opts?: { ifMatch?: string },
  ): Promise<boolean> {
    await this.connect();
    try {
      const result = await this.client.data.delete(
        resource,
        String(id),
        opts?.ifMatch ? { ifMatch: opts.ifMatch } : undefined,
      );
      // `success`, not `deleted` (objectstack#5638). `DeleteDataResult.deleted`
      // was a key no schema ever declared and no server path ever returned on
      // `DELETE /data/:object/:id` — the client's interface was a wrong CLAIM
      // about the response body, and `@objectstack/client` 17.0.0-rc.5
      // corrected it to the schema's `success`.
      //
      // This was live here, not cosmetic: `result.deleted` compiled and read
      // `undefined` at runtime, so the guard below never fired — a successful
      // delete emitted NO mutation event, leaving every subscriber's cache
      // stale — and this method, declared `Promise<boolean>`, actually resolved
      // `undefined`. Following the rename is what restores both.
      if (result.success) {
        this.emitMutation({ type: 'delete', resource, id });
      }
      return result.success;
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /**
   * Apply the same patch to many records in a single round-trip.
   *
   * Sends one `POST /api/v1/data/:object/updateMany` request whose body
   * is `{ records: ids.map(id => ({id, data: patch})), options: { continueOnError: true }}`.
   * The server iterates server-side (still N engine writes) but the
   * client only pays for ONE HTTP/auth/RLS round-trip — the relevant
   * perf win for inbox / list-toolbar "mark all read" / "archive
   * selected" interactions where N can easily be in the hundreds.
   *
   * Falls back to a sequential per-id loop when the connected client
   * does not expose `updateMany` (older clients / offline adapters).
   * In that case `continueOnError` semantics are emulated locally so
   * callers see the same return shape.
   */
  async bulkUpdate(
    resource: string,
    ids: ReadonlyArray<string | number>,
    patch: Partial<T>,
  ): Promise<number> {
    await this.connect();
    if (!ids || ids.length === 0) return 0;
    const records = ids.map((id) => ({ id: String(id), data: patch as any }));

    // Notify subscribers once for the whole batch (not per-id) so a single
    // "mark all read"/"archive selected" refreshes bound views exactly once.
    const emitBulk = (count: number): number => {
      if (count > 0) this.emitMutation({ type: 'update', resource });
      return count;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateMany = (this.client.data as any).updateMany;
    if (typeof updateMany === 'function') {
      try {
        const res = await updateMany(resource, records, { continueOnError: true });
        // The server returns BatchUpdateResponse { succeeded, failed, ... };
        // fall back to ids.length on adapters that return a bare array.
        if (res && typeof res === 'object' && typeof (res as any).succeeded === 'number') {
          return emitBulk((res as any).succeeded as number);
        }
        if (Array.isArray(res)) return emitBulk((res as any[]).length);
        return emitBulk(ids.length);
      } catch (err) {
        throw normaliseClientError(err);
      }
    }

    // Fallback: sequential per-id updates, tolerating failures.
    let succeeded = 0;
    for (const id of ids) {
      try {
        await this.client.data.update<T>(resource, String(id), patch);
        succeeded++;
      } catch {
        // continueOnError semantics — swallow per-row errors
      }
    }
    return emitBulk(succeeded);
  }

  /**
   * Single-call bulk delete. Mirrors the bulkUpdate contract: prefers
   * the server's `deleteMany` primitive when the client supports it;
   * otherwise emulates `continueOnError` by looping `delete` per id and
   * swallowing per-row failures. Returns the count of rows reported
   * deleted by the server (or successfully deleted in fallback mode).
   */
  async bulkDelete(
    resource: string,
    ids: ReadonlyArray<string | number>,
  ): Promise<number> {
    await this.connect();
    if (!ids || ids.length === 0) return 0;
    const strIds = ids.map((id) => String(id));

    // Notify subscribers once for the whole batch (see bulkUpdate).
    const emitBulk = (count: number): number => {
      if (count > 0) this.emitMutation({ type: 'delete', resource });
      return count;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteMany = (this.client.data as any).deleteMany;
    if (typeof deleteMany === 'function') {
      try {
        const res = await deleteMany(resource, strIds, { continueOnError: true });
        if (res && typeof res === 'object' && typeof (res as any).succeeded === 'number') {
          return emitBulk((res as any).succeeded as number);
        }
        if (Array.isArray(res)) return emitBulk((res as any[]).length);
        // deleteMany historically returns void on success — assume all hit.
        return emitBulk(strIds.length);
      } catch (err) {
        throw normaliseClientError(err);
      }
    }

    // Fallback: sequential per-id deletes, tolerating failures.
    let succeeded = 0;
    for (const id of strIds) {
      try {
        await this.client.data.delete(resource, id);
        succeeded++;
      } catch {
        // continueOnError semantics — swallow per-row errors
      }
    }
    return emitBulk(succeeded);
  }

  /**
   * Bulk operations with optimized batch processing and error handling.
   * Emits progress events for tracking operation status.
   * 
   * @param resource - Resource name
   * @param operation - Operation type (create, update, delete)
   * @param data - Array of records to process
   * @returns Promise resolving to array of results
   */
  /**
   * Cross-object transactional batch (ObjectStack #1604 / ADR-0034 item 4).
   * Runs the operations in ONE server transaction — commit all or roll back
   * all. A field value of `{ $ref: <earlier op index> }` resolves to that op's
   * created id, so a child can reference its parent created earlier in the same
   * batch (master-detail).
   *
   * Transport: the published `@objectstack/client` SDK method
   * `data.batchTransaction` (framework #3271; shipped since client v16, our
   * dependency floor). Per AGENTS.md §7 data always flows through the client —
   * never a hand-rolled `fetch('/api/v1/batch')`.
   *
   * Fallback decision — declarative capability negotiation (framework #3298 /
   * objectui #2693). At connect() we read `capabilities.transactionalBatch`
   * from discovery:
   *   - Declared `true` → the backend GUARANTEES atomicity (declared ===
   *     enforced). We TRUST it: any batch failure — including 404/405/501 —
   *     surfaces as a real error. No non-atomic client-side compensation. This
   *     is the path modern backends take.
   *   - Declared `false`, or ABSENT (backend predates #3298) → we can't rely on
   *     server atomicity, so we keep the legacy behaviour: on 404/405 (no
   *     endpoint) or 501 (runtime without transactions) degrade to the
   *     client-side, NON-atomic {@link emulateBatchTransaction} so a save is
   *     still possible. Removing that here would regress older backends from
   *     "saves, less safe" to "no save path" (#2679 compatibility constraint).
   *     The non-atomic fallback stays isolated to THIS adapter.
   */
  async batchTransaction(
    operations: BatchTransactionOperation[],
  ): Promise<{ results: any[] }> {
    // Ensure discovery (and thus the #3298 capability) is loaded so the
    // decision below is declarative, not "fire a batch and read the status".
    await this.connect();

    // When the backend declares atomic batch support we never degrade: a
    // failure is a real error, not a cue to fall back. Otherwise (declared
    // false, or capability absent on a pre-#3298 backend) the emulation
    // fallback below stays active.
    const guaranteed = this.atomicBatchCapability === true;

    // Already degraded on a non-declaring backend — skip the SDK call.
    // (Unreachable once `guaranteed`: that path never sets `batchUnsupported`.)
    if (!guaranteed && this.batchUnsupported) {
      return emulateBatchTransaction(this, operations);
    }

    try {
      // Typed SDK method — guaranteed present by the `@objectstack/client@^16`
      // dependency floor (framework #3271). No hand-rolled POST /api/v1/batch.
      const payload = await this.client.data.batchTransaction(operations);
      this.emitBatchMutations(operations, payload?.results);
      this.notifyBatchDroppedFields(operations, payload);
      return payload;
    } catch (err) {
      // On a non-declaring backend, endpoint missing (404/405) or a runtime that
      // can't do transactions (the framework rest-server answers 501
      // "Transactional batch not supported by this runtime") → degrade to the
      // non-atomic client emulation so the save still goes through. When the
      // backend DECLARED support (`guaranteed`), even these are hard errors — a
      // server that advertised the capability must honour it. Every other status
      // (400 validation, 401/403 auth, 409 conflict, 500 fault) is a real error
      // the caller must see — never silently retried.
      const status = this.errorStatusOf(err);
      if (!guaranteed && this.batchStatusUnsupported(status)) {
        return this.fallbackToEmulation(operations, status);
      }
      throw err;
    }
  }

  /** True for statuses that mean "this backend can't do a transactional batch". */
  private batchStatusUnsupported(status: number | undefined): boolean {
    return status === 404 || status === 405 || status === 501;
  }

  /** Best-effort HTTP status extraction from a thrown SDK/client error. */
  private errorStatusOf(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as Record<string, unknown>;
    const s = e.httpStatus ?? e.status ?? e.statusCode;
    return typeof s === 'number' ? s : undefined;
  }

  /** Mark the endpoint unsupported (warn once) and serve via emulation. */
  private fallbackToEmulation(
    operations: BatchTransactionOperation[],
    status: number | undefined,
  ): Promise<{ results: any[] }> {
    if (!this.batchUnsupported) {
      this.batchUnsupported = true;
      console.warn(
        `ObjectStackAdapter: POST /api/v1/batch unavailable (HTTP ${status ?? '?'}) — ` +
          'falling back to non-atomic client-side batch emulation. Cross-object ' +
          'saves on this backend are best-effort, not transactional.',
      );
    }
    return emulateBatchTransaction(this, operations);
  }

  /**
   * Emit one DataSourceMutationEvent per committed operation so the invalidation bus
   * (#2269) sees writes that went through /batch exactly like single
   * create/update/delete calls — master-detail ModalForm saves otherwise leave
   * related lists and count badges stale (#2582). `results` is index-aligned
   * with `operations`; creates take id/record from the server echo.
   *
   * Only called on the server-committed paths. The emulation branch drives the
   * adapter's own create/update/delete primitives, which already emit — so it
   * must NOT be routed through here, or events would double-fire.
   */
  private emitBatchMutations(
    operations: BatchTransactionOperation[],
    rawResults: unknown,
  ): void {
    const results = Array.isArray(rawResults) ? rawResults : [];
    operations.forEach((op, i) => {
      const action = op.action ?? 'create';
      const echo = results[i];
      if (action === 'create') {
        this.emitMutation({ type: 'create', resource: op.object, record: echo });
      } else if (action === 'update') {
        this.emitMutation({ type: 'update', resource: op.object, id: op.id ?? echo?.id ?? echo?._id, record: echo });
      } else if (action === 'delete') {
        this.emitMutation({ type: 'delete', resource: op.object, id: op.id });
      }
    });
  }

  async bulk(resource: string, operation: 'create' | 'update' | 'delete', data: Partial<T>[]): Promise<T[]> {
    await this.connect();

    if (!data || data.length === 0) {
      return [];
    }

    const total = data.length;
    let completed = 0;
    let failed = 0;

    const emitProgress = () => {
      this.emitBatchProgress({
        operation,
        total,
        completed,
        failed,
        percentage: total > 0 ? (completed + failed) / total * 100 : 0,
      });
    };

    try {
      switch (operation) {
        case 'create': {
          emitProgress();
          const created = await this.client.data.createMany<T>(resource, data);
          completed = created.length;
          failed = total - completed;
          emitProgress();
          // One resource-level event for the whole batch (same contract as
          // bulkUpdate/bulkDelete) so bound views refresh after subform child
          // rows are created through this path (#2582).
          if (completed > 0) this.emitMutation({ type: 'create', resource });
          return created;
        }
        
        case 'delete': {
          const ids = data.map(item => (item as Record<string, unknown>).id).filter(Boolean) as string[];
          
          if (ids.length === 0) {
            // Track which items are missing IDs
            const errors = data.map((_, index) => ({
              index,
              error: `Missing ID for item at index ${index}`
            }));
            
            failed = data.length;
            emitProgress();
            
            throw new BulkOperationError('delete', 0, data.length, errors);
          }
          
          emitProgress();
          await this.client.data.deleteMany(resource, ids);
          completed = ids.length;
          failed = total - completed;
          emitProgress();
          // One resource-level event per batch — see the create branch.
          if (completed > 0) this.emitMutation({ type: 'delete', resource });
          return [] as T[];
        }
        
        case 'update': {
          // Check if client supports updateMany
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (this.client.data as any).updateMany === 'function') {
            try {
              emitProgress();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateMany = (this.client.data as any).updateMany;
              const updated = await updateMany(resource, data) as T[];
              completed = updated.length;
              failed = total - completed;
              emitProgress();
              // One resource-level event per batch — see the create branch.
              if (completed > 0) this.emitMutation({ type: 'update', resource });
              return updated;
            } catch {
              // If updateMany is not supported, fall back to individual updates
              // Silently fallback without logging
            }
          }
          
          // Fallback: Process updates individually with detailed error tracking and progress
          const results: T[] = [];
          const errors: Array<{ index: number; error: unknown }> = [];
          
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const id = (item as Record<string, unknown>).id;
            
            if (!id) {
              errors.push({ index: i, error: 'Missing ID' });
              failed++;
              emitProgress();
              continue;
            }
            
            try {
              const result = await this.client.data.update<T>(resource, String(id), item);
              results.push(result.record);
              completed++;
              emitProgress();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              errors.push({ index: i, error: errorMessage });
              failed++;
              emitProgress();
            }
          }
          
          // Rows that DID persist must still reach subscribers, even when the
          // batch as a whole reports failure below (continueOnError semantics
          // — the successful writes are not rolled back).
          if (completed > 0) this.emitMutation({ type: 'update', resource });

          // If there were any errors, throw BulkOperationError
          if (errors.length > 0) {
            throw new BulkOperationError(
              'update',
              results.length,
              errors.length,
              errors,
              { resource, totalRecords: data.length }
            );
          }

          return results;
        }
        
        default:
          throw new ObjectStackError(
            `Unsupported bulk operation: ${operation}`,
            'UNSUPPORTED_OPERATION',
            400
          );
      }
    } catch (error: unknown) {
      // Emit final progress with failure
      emitProgress();
      
      // If it's already a BulkOperationError, re-throw it
      if (error instanceof BulkOperationError) {
        throw error;
      }
      
      // If it's already an ObjectStackError, re-throw it
      if (error instanceof ObjectStackError) {
        throw error;
      }
      
      // Wrap other errors in BulkOperationError with proper error tracking
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errors = data.map((_, index) => ({
        index,
        error: errorMessage
      }));
      
      throw new BulkOperationError(
        operation,
        0,
        data.length,
        errors,
        { resource, originalError: error }
      );
    }
  }

  /**
   * Bulk-import raw spreadsheet rows in a single server round-trip via
   * `POST /api/v1/data/:object/import`. The server performs all value coercion
   * (booleans, numbers, dates→ISO, select label→code, lookup name→id) from the
   * object's field metadata, so this method forwards the request verbatim and
   * returns the aggregate + per-row result untouched.
   *
   * Requires `@objectstack/client` with `data.import` (server `/import` route).
   * Callers should feature-detect (`typeof dataSource.importRecords`) and fall
   * back to a per-row `create` loop when unavailable.
   */
  async importRecords(
    resource: string,
    request: ImportRequestOptions,
  ): Promise<ImportRecordsResult> {
    await this.connect();
    const importFn = (this.client.data as { import?: unknown }).import;
    if (typeof importFn !== 'function') {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support data.import(). ' +
          'Upgrade the client, or import via a per-row create fallback.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      const result = await (importFn as (
        object: string,
        req: ImportRequestOptions,
      ) => Promise<ImportRecordsResult>).call(this.client.data, resource, request);
      return result;
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /**
   * Feature-detect the async import-job API on the connected client. Older
   * clients/servers lack these routes; callers fall back to {@link importRecords}.
   */
  private importJobApi(): {
    createImportJob: (object: string, req: ImportRequestOptions) => Promise<CreateImportJobResult>;
    getImportJobProgress: (jobId: string) => Promise<ImportJobProgressInfo>;
    getImportJobResults: (jobId: string) => Promise<ImportJobResultsInfo>;
    listImportJobs: (query: ListImportJobsOptions) => Promise<ImportJobSummaryInfo[]>;
    cancelImportJob: (jobId: string) => Promise<{ success: boolean }>;
    undoImportJob: (jobId: string) => Promise<ImportJobUndoResult>;
  } | undefined {
    const d = this.client.data as Record<string, unknown>;
    if (typeof d.createImportJob !== 'function') return undefined;
    return d as any;
  }

  /**
   * Start an asynchronous import job — the large-file counterpart to
   * {@link importRecords}. Posts the whole payload once; the server processes
   * rows in the background. Requires an `@objectstack/client` new enough to
   * expose `data.createImportJob` (server `/import/jobs` route). Callers should
   * feature-detect (`typeof dataSource.createImportJob`) and fall back to the
   * synchronous path when unavailable.
   */
  async createImportJob(
    resource: string,
    request: ImportRequestOptions,
  ): Promise<CreateImportJobResult> {
    await this.connect();
    const api = this.importJobApi();
    if (!api) {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support async import jobs (data.createImportJob). ' +
          'Upgrade the client, or use the synchronous importRecords() path.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      return await api.createImportJob.call(this.client.data, resource, request);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /** Poll an import job's progress. Requires {@link createImportJob} support. */
  async getImportJobProgress(jobId: string): Promise<ImportJobProgressInfo> {
    await this.connect();
    const api = this.importJobApi();
    if (!api) {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support async import jobs.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      return await api.getImportJobProgress.call(this.client.data, jobId);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /** Fetch an import job's capped per-row results. */
  async getImportJobResults(jobId: string): Promise<ImportJobResultsInfo> {
    await this.connect();
    const api = this.importJobApi();
    if (!api) {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support async import jobs.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      return await api.getImportJobResults.call(this.client.data, jobId);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /** List recent import jobs (history), newest first. */
  async listImportJobs(options: ListImportJobsOptions = {}): Promise<ImportJobSummaryInfo[]> {
    await this.connect();
    const api = this.importJobApi();
    if (!api) {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support async import jobs.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      return await api.listImportJobs.call(this.client.data, options);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /** Cancel a pending/running import job (cooperative). */
  async cancelImportJob(jobId: string): Promise<void> {
    await this.connect();
    const api = this.importJobApi();
    if (!api) {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support async import jobs.',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      await api.cancelImportJob.call(this.client.data, jobId);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /**
   * Logically roll back a finished import job — delete the records it created
   * and restore the records it updated to their pre-import values. Requires an
   * `@objectstack/client` new enough to expose `data.undoImportJob`, and a job
   * the server captured an undo log for (see {@link ImportJobProgressInfo.undoable}).
   */
  async undoImportJob(jobId: string): Promise<ImportJobUndoResult> {
    await this.connect();
    const api = this.importJobApi();
    if (!api || typeof (api as { undoImportJob?: unknown }).undoImportJob !== 'function') {
      throw new ObjectStackError(
        'The connected @objectstack/client does not support undoing import jobs (data.undoImportJob).',
        'UNSUPPORTED_OPERATION',
        400,
      );
    }
    try {
      return await api.undoImportJob.call(this.client.data, jobId);
    } catch (err) {
      throw normaliseClientError(err);
    }
  }

  /**
   * Normalize the result from data.find() or data.query() into a consistent QueryResult.
   */
  private normalizeQueryResult(result: unknown, params?: QueryParams): QueryResult<T> {
    // Handle legacy/raw array response (e.g. from some mock servers or non-OData endpoints)
    if (Array.isArray(result)) {
      return {
        data: result,
        total: result.length,
        page: 1,
        pageSize: result.length,
        hasMore: false,
      };
    }

    const resultObj = result as { records?: T[]; total?: number; value?: T[]; count?: number; hasMore?: boolean };
    const records = resultObj.records || resultObj.value || [];
    const total = resultObj.total ?? resultObj.count ?? records.length;
    // Prefer the server's `hasMore` (real server-side pagination, framework
    // issue #2212). Fall back to the page-local estimate (a full page implies
    // there may be more) only when the server doesn't report it.
    const hasMore = typeof resultObj.hasMore === 'boolean'
      ? resultObj.hasMore
      : (params?.$top ? records.length === params.$top : false);
    return {
      data: records,
      total,
      // Calculate page number safely
      page: params?.$skip && params.$top ? Math.floor(params.$skip / params.$top) + 1 : 1,
      pageSize: params?.$top,
      hasMore,
    };
  }

  /**
   * Make a raw GET request to the data API with `populate` as a URL query param.
   * Used when $expand is needed, since the client SDK's data.find() does not
   * support populate/expand. The server's REST API routes GET /data/:object
   * to findData({ object, query: req.query }) which processes `populate`.
   */
  private async rawFindWithPopulate(resource: string, params: QueryParams): Promise<unknown> {
    const queryParams = new URLSearchParams();

    // Populate: comma-separated field names for lookup expansion
    if (params.$expand && params.$expand.length > 0) {
      queryParams.set('populate', params.$expand.join(','));
    }

    // Pagination
    if (params.$top !== undefined) {
      queryParams.set('top', String(params.$top));
    }
    if (params.$skip !== undefined) {
      queryParams.set('skip', String(params.$skip));
    }

    // Full-text search (ADR-0061). The server resolves which fields to match
    // from object metadata; the client only sends the term (+ optional override).
    if (params.$search != null && String(params.$search).trim() !== '') {
      queryParams.set('search', String(params.$search).trim());
    }
    if (params.$searchFields && params.$searchFields.length > 0) {
      queryParams.set('searchFields', params.$searchFields.join(','));
    }

    // Selection — always include `id` to ensure records can be identified
    // for navigation/selection even when callers omit it from $select.
    if (params.$select && params.$select.length > 0) {
      const selectFields = params.$select.includes('id')
        ? params.$select
        : ['id', ...params.$select];
      queryParams.set('select', selectFields.join(','));
    }

    // Sorting
    const sortStr = serializeOrderBy(params.$orderby);
    if (sortStr) queryParams.set('sort', sortStr);

    // Filter — translate ViewFilterRule[] (`[{field, operator, value}]`)
    // and other shapes into AST tuples the server understands. Without this,
    // server-driven views (e.g. `at_risk_accounts`, `hot_leads`) ship raw
    // `[{field,operator,value}]` arrays which `parseFilterAST` silently
    // discards, returning every record instead of the filtered subset.
    if (params.$filter !== undefined && params.$filter !== null) {
      const translated = translateFilterToAST(params.$filter);
      if (translated !== undefined) {
        queryParams.set('filter', JSON.stringify(translated));
      }
    }

    const baseUrl = this.baseUrl.replace(/\/$/, '');
    const qs = queryParams.toString();
    // Avoid doubling /api/v1 if baseUrl already includes it
    const hasApiVersionSuffix = /\/api\/v\d+$/i.test(baseUrl);
    const dataPath = hasApiVersionSuffix ? '/data' : '/api/v1/data';
    const url = `${baseUrl}${dataPath}/${resource}${qs ? `?${qs}` : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.fetchImpl(url, { method: 'GET', headers });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(errorBody?.error?.message || errorBody?.message || res.statusText) as any;
      err.status = res.status;
      throw err;
    }

    const body = await res.json();
    // Unwrap standard response envelope { success, data }
    if (body && typeof body.success === 'boolean' && 'data' in body) {
      return body.data;
    }
    return body;
  }

  /**
   * Synchronously download a server-streamed export (csv / json / xlsx).
   *
   * Hits `GET /api/v1/data/:object/export`, which streams matching rows in the
   * requested format, formats values for readability (lookup → name, select →
   * label, boolean → 是/否, dates formatted) and enforces permissions. The
   * filter / sort are translated the same way as `rawFindWithPopulate` so the
   * exported file mirrors the active list view. Returns the file as a Blob;
   * the caller triggers the browser download.
   */
  async exportDownload(resource: string, request: ExportDownloadRequest = {}): Promise<Blob> {
    const queryParams = new URLSearchParams();

    const format = request.format === 'xlsx' ? 'xlsx' : request.format === 'json' ? 'json' : 'csv';
    queryParams.set('format', format);

    if (request.fields && request.fields.length > 0) {
      queryParams.set('fields', request.fields.join(','));
    }
    if (request.limit && request.limit > 0) {
      queryParams.set('limit', String(request.limit));
    }
    if (request.includeHeaders === false) {
      queryParams.set('header', 'false');
    }
    // Sort → server `orderby` shorthand: "field:dir,field2:dir".
    if (request.sort && request.sort.length > 0) {
      const orderby = request.sort
        .filter(s => s && s.field)
        .map(s => `${s.field}:${s.direction === 'desc' ? 'desc' : 'asc'}`)
        .join(',');
      if (orderby) queryParams.set('orderby', orderby);
    }
    // Filter → AST tuples, same translation the list GET path uses.
    if (request.filter !== undefined && request.filter !== null) {
      const translated = translateFilterToAST(request.filter);
      if (translated !== undefined) {
        queryParams.set('filter', JSON.stringify(translated));
      }
    }
    // Search — the other half of what a list is showing. Without it an export
    // taken while a search is active returns the unsearched superset
    // (objectstack#4230). Servers predating that ignore the param.
    const searchTerm = typeof request.search === 'string' ? request.search.trim() : '';
    if (searchTerm) {
      queryParams.set('search', searchTerm);
      if (request.searchFields && request.searchFields.length > 0) {
        queryParams.set('searchFields', request.searchFields.join(','));
      }
    }

    const baseUrl = this.baseUrl.replace(/\/$/, '');
    // Avoid doubling /api/v1 if baseUrl already includes the version suffix.
    const hasApiVersionSuffix = /\/api\/v\d+$/i.test(baseUrl);
    const dataPath = hasApiVersionSuffix ? '/data' : '/api/v1/data';
    const url = `${baseUrl}${dataPath}/${encodeURIComponent(resource)}/export?${queryParams.toString()}`;

    const headers: Record<string, string> = { ...this.getAuthHeaders() };
    // `credentials: 'include'` carries the session cookie for the browser
    // console (which authenticates by cookie, not a bearer token).
    const res = await this.fetchImpl(url, { method: 'GET', headers, credentials: 'include' });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(errorBody?.error?.message || errorBody?.message || res.statusText) as any;
      err.status = res.status;
      throw err;
    }
    return await res.blob();
  }

  /**
   * Convert ObjectUI QueryParams to ObjectStack QueryOptions.
   * Maps OData-style conventions to ObjectStack conventions.
   */
  private convertQueryParams(params?: QueryParams): ObjectStackQueryOptions {
    if (!params) return {};

    const options: ObjectStackQueryOptions = {};

    // Selection — always include `id` so records remain identifiable for
    // navigation/selection even when callers omit it from $select.
    if (params.$select) {
      options.select = params.$select.includes('id')
        ? params.$select
        : ['id', ...params.$select];
    }

    // Filtering - convert to ObjectStack FilterNode AST format. Treat empty
    // arrays/objects as "no filter" to avoid emitting `filter=[]` over the wire.
    if (params.$filter !== undefined && params.$filter !== null) {
      const isEmpty = Array.isArray(params.$filter)
        ? params.$filter.length === 0
        : typeof params.$filter === 'object' && Object.keys(params.$filter).length === 0;
      if (!isEmpty) {
        if (Array.isArray(params.$filter)) {
          // Two array shapes are accepted from upstream:
          //   1. AST tuples:  [field, op, value]                 — pass through.
          //   2. Object form: [{ field, operator, value }, ...]  — server-driven
          //      view configs (lead.view.ts etc.) use this. Translate each
          //      entry into the AST tuple shape and map human-readable
          //      operator names (`greater_than_or_equal`, `in`, `contains`,
          //      …) to the canonical symbols the server understands.
          // Shared with `translateFilterToAST` so the two `find()` routes — this
          // one and the `$expand`/`$search` raw GET — cannot disagree about the
          // same stored filter.
          options.filters = translateFilterArray(params.$filter);
        } else {
          options.filters = convertFiltersToAST(params.$filter);
        }
      }
    }

    // Sorting — the same serializer the raw GET route uses, so the two `find()`
    // paths cannot disagree about one stored sort. The client SDK's
    // `QueryOptions.sort` accepts the shorthand string directly.
    const sort = serializeOrderBy(params.$orderby);
    if (sort) options.sort = sort;

    // Pagination
    if (params.$skip !== undefined) {
      options.skip = params.$skip;
    }

    if (params.$top !== undefined) {
      options.top = params.$top;
    }

    if (params.$search != null && String(params.$search).trim() !== '') {
      (options as Record<string, unknown>).search = String(params.$search).trim();
    }
    if (params.$searchFields && params.$searchFields.length > 0) {
      (options as Record<string, unknown>).searchFields = params.$searchFields;
    }

    return options;
  }

  /**
   * Get object schema/metadata from ObjectStack.
   * Uses caching to improve performance for repeated requests.
   * 
   * @param objectName - Object name
   * @returns Promise resolving to the object schema
   */
  async getObjectSchema(objectName: string): Promise<unknown> {
    await this.connect();
    
    try {
      // Use cache with automatic fetching. The cache is keyed by object name
      // only (locale-independent); a language switch wipes it wholesale via
      // `clearCache()` so the next read re-fetches in the new locale — see the
      // shell's locale remount (issue #1319). Keeping the key locale-free here
      // means a metadata *write* still invalidates the single entry it knows
      // about, without having to fan out across every cached locale.
      // Read through a cache-revalidating fetch (see fetchObjectSchemaFresh):
      // the server marks single-object metadata `public, max-age=3600`, so a
      // plain fetch would keep serving the pre-publish schema from the browser
      // HTTP cache for up to an hour — and the create/edit form (which reads
      // getObjectSchema) would never show a field added + published in this
      // session. The list endpoint is uncached, which is why list views already
      // refresh on publish.
      const schema = await this.metadataCache.get(objectName, () =>
        this.fetchObjectSchemaFresh(objectName),
      );

      // Canonicalize the relational-target key: the server names it
      // `reference` (ObjectStack convention) while most consumers read
      // `reference_to` (#2407 / PR #2587). Stamping both here — the choke
      // point every schema read goes through — means no per-consumer
      // dual-key fallback can drift. Idempotent on the cached object.
      normalizeSchemaReferenceKeys(schema);

      // ADR-0056 P2 (epic #2398): stamp structured-widget hints onto specific
      // platform fields. This is the single choke point both the record form
      // (ObjectForm) and the detail view (DetailView/DetailSection) read the
      // schema through, so one pass here reaches every edit surface.
      this.applyFieldWidgetOverrides(objectName, schema);

      return schema;
    } catch (error: unknown) {
      // Check if it's a 404 error
      const errorObj = error as Record<string, unknown>;
      if (is404Error(errorObj)) {
        throw new MetadataNotFoundError(objectName, { originalError: error });
      }
      
      // For other errors, wrap in ObjectStackError if not already
      if (error instanceof ObjectStackError) {
        throw error;
      }
      
      throw createErrorFromResponse(errorObj, `getObjectSchema(${objectName})`);
    }
  }

  /**
   * ADR-0056 P2 (epic #2398) — stamp structured-widget hints onto platform
   * fields whose framework type is a storage primitive (e.g. `textarea`) but
   * whose authoring UX should be a structured editor. Only the render `widget`
   * is added; the field's `type` (the storage contract) is untouched. Applied
   * idempotently to the cached schema so form + detail both honor it. Widget
   * components are registered as `field:<widget>` in `@object-ui/fields`.
   */
  private applyFieldWidgetOverrides(objectName: string, schema: unknown): void {
    const OVERRIDES: Record<string, Record<string, string>> = {
      // ADR-0056 pure model — a permission set's six authorization facets are
      // *designed* in Studio's structured editors and only *assigned* (to
      // users) in Setup. In Setup they render read-only as a summary + a
      // "Design in Studio →" deep-link (the `permission-facet-link` widget),
      // never as raw [Object]/JSON. The capability *editor* itself lives in
      // Studio (epic #2398 P2).
      sys_permission_set: {
        object_permissions: 'permission-facet-link',
        field_permissions: 'permission-facet-link',
        system_permissions: 'permission-facet-link',
        row_level_security: 'permission-facet-link',
        tab_permissions: 'permission-facet-link',
        admin_scope: 'permission-facet-link',
      },
    };
    const overrides = OVERRIDES[objectName];
    const fields =
      schema && typeof schema === 'object' ? (schema as { fields?: unknown }).fields : null;
    if (!overrides || !fields) return;
    for (const [fname, widget] of Object.entries(overrides)) {
      if (Array.isArray(fields)) {
        const f = fields.find((x: any) => x?.name === fname);
        if (f && !f.widget) f.widget = widget;
      } else {
        const f = (fields as Record<string, any>)[fname];
        if (f && !f.widget) f.widget = widget;
      }
    }
  }

  /**
   * Fetch a single object's schema while always revalidating the browser cache.
   *
   * The server serves `GET /api/v1/meta/object/:name` with
   * `Cache-Control: public, max-age=3600`, so the default `fetch` the SDK uses
   * keeps returning the same response from the browser HTTP cache for up to an
   * hour without contacting the origin. Because the create/edit form reads the
   * object schema through {@link getObjectSchema}, a field added + published in
   * the same session never appears in the form even though it is live (the LIST
   * endpoint, `/meta/object`, is uncached — which is why list views update).
   *
   * Issuing the read with `cache: 'no-cache'` forces a conditional revalidation
   * (`If-None-Match`): a changed ETag returns the fresh schema, an unchanged one
   * still gets a cheap `304`. We go through `fetchImpl` (the adapter's
   * authenticated fetch) rather than `client.meta.getItem` because the SDK does
   * not expose the request cache mode.
   */
  private async fetchObjectSchemaFresh(objectName: string): Promise<unknown> {
    const baseUrl = (this.baseUrl || '').replace(/\/$/, '');
    // Avoid doubling /api/v1 when baseUrl already carries the version suffix
    // (mirrors rawFindWithPopulate).
    const hasApiVersionSuffix = /\/api\/v\d+$/i.test(baseUrl);
    const metaPath = hasApiVersionSuffix ? '/meta' : '/api/v1/meta';
    const url = `${baseUrl}${metaPath}/object/${encodeURIComponent(objectName)}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Bearer (server-to-server) callers configure `this.token`; cookie/console
    // auth is injected by `fetchImpl` (the authenticated fetch wrapper).
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers,
      // Revalidate instead of serving the stale `max-age` body (see doc above).
      cache: 'no-cache',
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({ message: res.statusText }));
      const err: any = new Error(errBody?.error?.message || errBody?.message || res.statusText);
      err.status = res.status;
      throw err;
    }

    const body: any = await res.json();
    // Unwrap defensively across server/SDK response shapes: the standard
    // `{ success, data }` envelope, an `{ item }` wrapper, or the bare item.
    const data = body && typeof body === 'object' && 'success' in body && 'data' in body ? body.data : body;
    return data && typeof data === 'object' && 'item' in data ? data.item : data;
  }

  /**
   * List every registered object (code- and DB-defined) from the metadata
   * registry — `GET /api/v1/meta/object`. Returns lightweight `{ name, label }`
   * headers for object-picker widgets (e.g. the sharing-rule `object-ref`
   * field). The list endpoint is uncached server-side, so no cache-busting
   * dance is needed. Returns `[]` on any failure so callers degrade gracefully.
   */
  async getObjects(): Promise<Array<{ name: string; label?: string }>> {
    try {
      await this.connect();
      const baseUrl = (this.baseUrl || '').replace(/\/$/, '');
      // Avoid doubling /api/v1 when baseUrl already carries the version suffix
      // (mirrors fetchObjectSchemaFresh).
      const hasApiVersionSuffix = /\/api\/v\d+$/i.test(baseUrl);
      const metaPath = hasApiVersionSuffix ? '/meta' : '/api/v1/meta';
      const url = `${baseUrl}${metaPath}/object`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const res = await this.fetchImpl(url, { method: 'GET', headers });
      if (!res.ok) return [];
      const body: any = await res.json();
      // Unwrap the `{ success, data }` envelope, the `{ type, items }` list
      // shape, or a bare array.
      const data =
        body && typeof body === 'object' && 'success' in body && 'data' in body ? body.data : body;
      const items: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
      return items
        .map((it: any) => ({
          name: String(it?.name ?? ''),
          label: it?.label != null ? String(it.label) : undefined,
        }))
        .filter((it) => it.name);
    } catch {
      return [];
    }
  }

  /**
   * Get access to the underlying ObjectStack client for advanced operations.
   */
  getClient(): ObjectStackClient {
    return this.client;
  }

  /**
   * Get the discovery information from the connected server.
   * Returns the capabilities and service status of the ObjectStack server.
   * 
   * Note: This accesses an internal property of the ObjectStackClient.
   * The discovery data is populated during client.connect() and cached.
   * 
   * @returns Promise resolving to discovery data, or null if not connected
   */
  async getDiscovery(): Promise<unknown | null> {
    try {
      // Ensure we're connected first
      await this.connect();
      
      // Access discovery data from the client
      // The ObjectStackClient caches discovery during connect()
      // This is an internal property, but documented for this use case
      // @ts-expect-error - Accessing internal discoveryInfo property
      return this.client.discoveryInfo || null;
    } catch {
      return null;
    }
  }

  /**
   * Batch-fetch all persisted view overrides for an object.
   *
   * Per-view runtime overrides (density, column widths, sort, hidden
   * columns, inlineEdit …) live in the SAME metadata namespace the
   * write path uses: `type='view'`, `name=<viewId>` (see
   * {@link updateViewConfig}). Loading them per-view fires N HTTP GETs
   * that 404 for every view the user never customized — console noise on
   * every page load. This batch method performs a single
   * `GET /api/v1/meta/view` (returns `{type, items}`) and narrows the
   * result to `objectName` client-side, exactly as {@link listViews}
   * does over the same rows (shared accessor: {@link viewItemObjectName}).
   *
   * objectui#3774 — this used to enumerate `GET /api/v1/meta/<objectName>`,
   * putting the OBJECT name in the metadata TYPE slot. That key space is
   * disjoint from the one the write path lands in, so the batch map came
   * back empty for every object, forever, and every saved personalization
   * read back as "setting didn't save".
   *
   * FAILURES REJECT — they are not answered as `{}`. An empty map is an
   * authoritative "this object has no overrides" (callers may trust it and
   * skip the per-view reads); a transport/permission failure is "I could
   * not tell", and reporting the two as the same value is what made
   * ObjectView's per-view {@link getView} fallback unreachable code. When
   * we cannot tell, we do not pretend we can. Rejections are not cached
   * (the cache stores on success only), so a transient failure does not
   * pin an empty answer for the TTL.
   *
   * Result is cached identically to {@link getView}, and EVERY view write path
   * on this adapter invalidates it — {@link updateViewConfig},
   * {@link createView}, {@link updateView} and {@link deleteView}. For a long
   * time only the first did (objectui#4363), which left the other three stale
   * for the cache's 5-minute TTL. That gap does not self-heal: the consumer
   * (`loadViewOverrides`, app-shell `ObjectView`) treats a RESOLVED map as
   * authoritative and deliberately does not re-probe per view — objectui#3774,
   * and correct, since re-probing reinstates the 404 flurry the batch read
   * exists to remove. So a stale map here is served in full, and the per-view
   * {@link getView} fallback that would have masked it never runs.
   *
   * @param objectName - Object name (e.g. 'lead')
   * @returns Map keyed by view name with the persisted override config
   * @throws whatever the metadata transport throws — callers that have a
   *   per-view fallback should catch and use it.
   */
  async listViewOverrides(objectName: string): Promise<Record<string, any>> {
    await this.connect();

    const cacheKey = `view-overrides:${objectName}`;
    return await this.metadataCache.get(cacheKey, async () => {
      const result: any = await this.client.meta.getItems('view');
      const items: any[] = Array.isArray(result?.items)
        ? result.items
        : Array.isArray(result) ? result : [];
      const out: Record<string, any> = {};
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        if (viewItemObjectName(it) !== objectName) continue;
        // Keyed by the item's canonical `name` — the SAME identity
        // `updateViewConfig` writes under and `getView` reads back by, which
        // is what makes this a drop-in substitute for the per-view fetch.
        // No `?? id ?? _name` alias chain: those are not view identities on
        // any route (`/meta/view/:name` is name-addressed), and a batch map
        // keyed by something no caller can ask for is dead weight.
        const key = it.name;
        if (typeof key === 'string' && key) out[key] = it;
      }
      return out;
    });
  }

  /**
   * Get a view definition for an object.
   * Attempts to fetch from the server metadata API.
   * Falls back to null if the server doesn't provide view definitions,
   * allowing the consumer to use static config.
   * 
   * @param objectName - Object name
   * @param viewId - View identifier
   * @returns Promise resolving to the view definition or null
   */
  async getView(objectName: string, viewId: string): Promise<unknown | null> {
    await this.connect();

    try {
      const cacheKey = `view:${objectName}:${viewId}`;
      return await this.metadataCache.get(cacheKey, async () => {
        // Views are an independent metadata type (ADR-0017) — the first
        // getItem argument is the metadata TYPE, not the object name.
        // (Passing objectName here hit /meta/<object>/<view> and always 404ed.)
        const result: any = await this.client.meta.getItem('view', viewId);
        if (result && result.item) return result.item;
        return result ?? null;
      });
    } catch {
      // Server doesn't support view metadata — return null to fall back to static config
      return null;
    }
  }

  /**
   * Persist a view definition for an object.
   *
   * Symmetric counterpart to {@link getView}: writes the view to the
   * server metadata store via `client.meta.saveItem`, then invalidates
   * the matching cache entry so the next {@link getView} reflects the
   * new payload. Returns the persisted item when the server echoes it,
   * otherwise undefined.
   *
   * Used by ObjectView for "live" toolbar persistence (density,
   * column widths, sort, etc.) and by the View Config Panel for
   * explicit saves.
   *
   * @param objectName - Object name (e.g. 'lead')
   * @param viewId - View identifier (e.g. 'all_leads')
   * @param config - Full view definition to persist
   */
  async updateViewConfig(
    objectName: string,
    viewId: string,
    config: Record<string, any>
  ): Promise<Record<string, any> | void> {
    await this.connect();
    // ADR-0005 metadata customization overlay: persist views under
    // `type='view'` (NOT `type=<objectName>` — that was a pre-overlay
    // misuse that hit `/api/v1/meta/<objectName>/<viewId>`, which the
    // server never wired). The view's `data.object` field is what
    // associates it back to the object on read.
    const merged = { ...(config || {}), object: (config as any)?.object || objectName, name: viewId };
    const result: any = await this.client.meta.saveItem(
      'view',
      viewId,
      merged
    );
    // Invalidate cached read so next getView reflects the change
    const cacheKey = `view:${objectName}:${viewId}`;
    this.metadataCache.invalidate?.(cacheKey);
    // Also invalidate the batch override map so listViewOverrides re-fetches
    this.metadataCache.invalidate?.(`view-overrides:${objectName}`);
    if (result && result.item) return result.item;
    return result ?? undefined;
  }

  /**
   * List user-created views for a given object via the metadata overlay
   * API (ADR-0005). Replaces the legacy `find('sys_view', {...})` path
   * that wrote to a physical `sys_view` table whose columns no longer
   * match the view spec shape.
   *
   * Returns view spec objects with their canonical `name` as identifier.
   * Narrows to one object client-side via {@link viewItemObjectName} —
   * the metadata index is name-only, not field-typed, so the route has no
   * `?object=` to push the filter down into. {@link listViewOverrides}
   * reads the same rows through the same accessor.
   */
  async listViews(
    objectName: string,
    options?: { previewDrafts?: boolean },
  ): Promise<any[]> {
    await this.connect();
    try {
      let items: any[];
      if (options?.previewDrafts) {
        // ADR-0037 + #2767 (P2/P3): a SINGLE `?preview=draft` request already
        // returns the active+draft OVERLAID list — draft wins by name,
        // draft-only views surface, each draft tagged `_draft: true`. So we
        // REPLACE the published list wholesale (never fetch both and append,
        // which double-lists a draft that edits a published view). Route it
        // through `MetadataClient` rather than a hand-rolled fetch so the
        // metadata route + any environment scoping stay in one place.
        const draftItems = await this.metadataClient()
          .withPreviewDrafts(true)
          .list<any>('view');
        items = Array.isArray(draftItems) ? draftItems : [];
      } else {
        const result: any = await this.client.meta.getItems('view');
        items = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result) ? result : [];
      }
      // This feeds the list-view switcher (ViewTabBar), so it must return
      // LIST-family views only. The backend now exposes each view as an
      // independent ViewItem carrying a `viewKind` discriminant (ADR-0017);
      // form-family views (`form`/`detail`) are record forms, not list tabs,
      // and must be excluded — otherwise e.g. `crm_activity.default` (a form)
      // leaks in as a spurious switcher tab. Bare specs without `viewKind`
      // (legacy artifacts / saved views) are kept as list views.
      const FORM_FAMILY = new Set(['form', 'detail']);
      return items.filter((v: any) => {
        if (!v) return false;
        // Handle both bare view spec and `{list: {...}}` artifact wrapper
        const spec = v.list ?? v;
        if (viewItemObjectName(v) !== objectName) return false;
        const viewKind = v.viewKind ?? spec?.viewKind;
        return !(viewKind && FORM_FAMILY.has(viewKind));
      }).map((v: any) => {
        const spec = v.list ?? v;
        // Preserve the draft provenance flag so the switcher can badge an
        // unpublished view (ADR-0037). The overlay tags the item, not its
        // nested spec, so read from either.
        const isDraft = v._draft === true || spec?._draft === true;
        // Canonical ViewItem (ADR-0017) carries its body under `config`;
        // the display `type` (grid/kanban/gallery/…) lives at `config.type`,
        // and only the list/form *family* sits at the top level (`viewKind`).
        // Flatten `config` up to the legacy NamedListView shape the switcher +
        // ObjectView consume — mirroring MetadataProvider.mergeViewsIntoObjects
        // so the two paths don't drift. Without this an un-flattened item has
        // no top-level `type`, so ObjectView's saved-view normalization defaults
        // it to 'grid' and overrides the metadata entry — a kanban/gallery/
        // calendar view then silently renders as a plain table.
        if (spec && spec.config && typeof spec.config === 'object') {
          return {
            ...spec.config,
            name: spec.name ?? spec.config.name,
            label: spec.label ?? spec.config.label,
            isDefault: !!spec.isDefault,
            ...(isDraft ? { _draft: true } : {}),
          };
        }
        return isDraft ? { ...spec, _draft: true } : spec;
      });
    } catch (err) {
      console.warn('[OBJECTSTACKDataSource] listViews failed:', err);
      return [];
    }
  }

  /**
   * Build a {@link MetadataClient} bound to this adapter's server + auth. Used
   * by draft-aware reads (`listViews({ previewDrafts })`) so the `/meta` route,
   * `?preview=draft` flag, and environment scoping live in the SDK rather than
   * being hand-assembled at each call site (#2767 P3).
   */
  private metadataClient(): MetadataClient {
    return new MetadataClient({
      baseUrl: this.baseUrl,
      fetch: this.fetchImpl,
      ...(this.token ? { headers: { Authorization: `Bearer ${this.token}` } } : {}),
    });
  }

  /**
   * List registered import `mapping` artifacts targeting a given object
   * (framework #2611). Reads the `mapping` metadata kind via the overlay API
   * and filters by `targetObject` client-side (the metadata index is
   * name-only). Feeds the import wizard's "saved mapping" selector; a failure
   * (older server without the `mapping` kind) degrades to an empty list, so
   * the selector simply doesn't appear.
   */
  async listImportMappings(objectName: string): Promise<any[]> {
    await this.connect();
    try {
      const result: any = await this.client.meta.getItems('mapping');
      const items: any[] = Array.isArray(result?.items)
        ? result.items
        : Array.isArray(result) ? result : [];
      return items.filter((m: any) => m && m.targetObject === objectName);
    } catch (err) {
      console.warn('[OBJECTSTACKDataSource] listImportMappings failed:', err);
      return [];
    }
  }

  /**
   * Create a new overlay view for an object. The view's `name` is the
   * stable identifier — must be unique within the project scope. Returns
   * the persisted view spec (or undefined when the server doesn't echo).
   *
   * Generates a snake_case name if `spec.name` is not provided by appending
   * a short timestamp suffix to the source-name hint.
   *
   * Invalidates both view-shaped cache keys for the object, exactly as
   * {@link updateViewConfig} does — see {@link listViewOverrides} for why the
   * batch map is the one that cannot heal itself (objectui#4363).
   */
  async createView(
    objectName: string,
    spec: Record<string, any>,
  ): Promise<Record<string, any> | void> {
    await this.connect();
    let name = String(spec?.name || '').trim();
    if (!name) {
      let base = String(spec?.label || objectName || 'view')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
      // Spec requires snake_case starting with a letter or underscore.
      // Labels like "表格 1" collapse to "1" after non-ascii stripping, so we
      // need a fallback / prefix to keep the identifier valid.
      if (!base || /^[0-9]/.test(base)) {
        base = base ? `view_${base}` : 'view';
      }
      const suffix = Date.now().toString(36);
      name = `${base}_${suffix}`;
    }
    const fullSpec = {
      ...spec,
      name,
      object: spec?.object || objectName,
      data: spec?.data || { provider: 'object', object: objectName },
    };
    const result: any = await this.client.meta.saveItem('view', name, fullSpec);
    // Same key set as `updateViewConfig` — this is the other `saveItem('view', …)`
    // write, and `saveItem` is an UPSERT: an explicit `spec.name` that already
    // exists overwrites the published row, which a prior `getView` may hold.
    // (A generated name cannot collide, and a miss is a `Map.delete` on an absent
    // key, so the uniform rule costs nothing on the create-a-new-row path.)
    this.metadataCache.invalidate?.(`view:${objectName}:${name}`);
    // The batch override map gains a row and cannot notice on its own (#4363).
    this.metadataCache.invalidate?.(`view-overrides:${objectName}`);
    if (result && result.item) return result.item;
    return fullSpec;
  }

  /**
   * Apply a partial update to an existing overlay view. Reads the current
   * document, merges, and writes it back. ADR-0005 overlay rows store the
   * *full* view document, so partial updates require a read-merge-write cycle.
   *
   * **Both halves address the same row (#4139).** A view has two possible
   * homes and the read must resolve the one the write will target:
   *
   * - a pending per-item **draft** (`?state=draft` / `?mode=draft`) — where
   *   ADR-0034 stages every runtime-created view, so a view made from the `+`
   *   tab lives ONLY here until an explicit Publish;
   * - the **published** overlay (`client.meta.getItem` / `saveItem`).
   *
   * The draft is probed FIRST, and a hit is merged and written straight back
   * as a draft. Two things that ordering buys, both load-bearing:
   *
   * 1. A draft-only view is no longer invisible to the read. It used to 404,
   *    and a `catch {}` labelled "treat missing as create-equivalent"
   *    substituted `current = {}` — so a rename merged onto nothing and went
   *    out as a `{label, name, object}` partial the server rejects (422),
   *    while the draft row the UI reads back through `?preview=draft` kept the
   *    old label. The edit was lost with no error surfaced to the user.
   * 2. A draft is never bypassed. Writing the published row while a draft is
   *    pending would put the edit somewhere the draft shadows — and Publish
   *    would then overwrite it with the pre-edit body, losing the change a
   *    second time, later, where nothing connects it to this call.
   *
   * A draft edit stays a draft: `mode: 'draft'` keeps ADR-0037's guarantee
   * that nothing the preview shows goes live until Publish. Renaming a
   * *published* view (no draft pending) is unchanged — it writes the
   * published overlay, as before.
   *
   * **Both halves invalidate the same two keys** (objectui#4363): the per-view
   * {@link getView} key and the batch {@link listViewOverrides} map. On the
   * draft half that is deliberate over-invalidation — both readers enumerate
   * PUBLISHED rows, so a draft write stales neither, exactly as was already
   * true of the per-view line this joins. The costs are not symmetric: an
   * unnecessary invalidation costs one refetch, a missed one costs up to the
   * cache's 5-minute TTL of stale overrides, and "which half am I in?" is not
   * a question a future edit to this method should have to re-answer.
   *
   * @throws when the view resolves in neither home, or when either read fails
   *   for any other reason (network, permission). Both used to be swallowed
   *   and converted into the bad partial write above; a caller that wants a
   *   view created should call {@link createView}, which is the operation that
   *   actually means "create".
   */
  async updateView(
    objectName: string,
    viewName: string,
    partial: Record<string, any>,
  ): Promise<Record<string, any> | void> {
    await this.connect();

    // ── Draft-addressed path ────────────────────────────────────────────
    // `MetadataClient.get` answers `null` on 404 (no draft pending) and throws
    // on anything else, so a transport failure here is NOT read as "published".
    const metaClient = this.metadataClient();
    const draft = unwrapViewDraft(
      await metaClient.get('view', viewName, { state: 'draft' }),
    );
    if (draft) {
      const mergedDraft = mergeViewPatch(draft, partial, viewName, objectName);
      await metaClient.save('view', viewName, mergedDraft, { mode: 'draft' });
      this.metadataCache.invalidate?.(`view:${objectName}:${viewName}`);
      this.metadataCache.invalidate?.(`view-overrides:${objectName}`);
      return mergedDraft;
    }

    // ── Published-overlay path (unchanged addressing) ────────────────────
    let current: any;
    try {
      const r: any = await this.client.meta.getItem('view', viewName);
      current = (r && (r.item || r)) || {};
      // Some endpoints return the bare item; others wrap as {type,name,item}
      if (current?.list) current = current.list;
    } catch (err) {
      if (is404Error(err)) {
        // Not a draft, not published, not an artifact — there is nothing to
        // merge onto. Fail loudly instead of emitting the partial write.
        throw Object.assign(
          new Error(
            `updateView: view "${viewName}" not found on object "${objectName}"` +
              ' — no pending draft and no published overlay. Use createView() to create one.',
          ),
          { cause: err },
        );
      }
      // Network / permission / server fault: surface it. Degrading to a
      // create-equivalent write here is what corrupted the row before.
      throw err;
    }

    const merged = mergeViewPatch(current, partial, viewName, objectName);
    const result: any = await this.client.meta.saveItem('view', viewName, merged);
    this.metadataCache.invalidate?.(`view:${objectName}:${viewName}`);
    this.metadataCache.invalidate?.(`view-overrides:${objectName}`);
    if (result && result.item) return result.item;
    return merged;
  }

  /**
   * Delete an overlay view (reset to artifact default if one exists, or
   * remove entirely if it was a user-created view). Routes to
   * `DELETE /api/v1/meta/view/:name`.
   *
   * Invalidates both view-shaped keys: the deleted row leaves the batch
   * override map too, and a ghost entry there is what the object page would
   * keep applying (objectui#4363).
   */
  async deleteView(
    objectName: string,
    viewName: string,
  ): Promise<{ deleted: boolean }> {
    await this.connect();
    const result: any = await this.client.meta.deleteItem('view', viewName);
    this.metadataCache.invalidate?.(`view:${objectName}:${viewName}`);
    this.metadataCache.invalidate?.(`view-overrides:${objectName}`);
    return { deleted: !!(result?.deleted ?? result?.reset ?? true) };
  }


  /**
   * Get an application definition by name or ID.
   * Attempts to fetch from the server metadata API.
   * Falls back to null if the server doesn't provide app definitions,
   * allowing the consumer to use static config.
   * 
   * @param appId - Application identifier
   * @returns Promise resolving to the app definition or null
   */
  async getApp(appId: string): Promise<unknown | null> {
    await this.connect();

    try {
      const cacheKey = `app:${appId}`;
      return await this.metadataCache.get(cacheKey, async () => {
        const result: any = await this.client.meta.getItem('apps', appId);
        if (result && result.item) return result.item;
        return result ?? null;
      });
    } catch {
      // Server doesn't support app metadata — return null to fall back to static config
      return null;
    }
  }

  /**
   * Get a page definition from ObjectStack.
   * Uses the metadata API to fetch page layouts.
   * Returns null if the server doesn't support page metadata.
   */
  async getPage(pageId: string): Promise<unknown | null> {
    await this.connect();

    try {
      const cacheKey = `page:${pageId}`;
      return await this.metadataCache.get(cacheKey, async () => {
        const result: any = await this.client.meta.getItem('pages', pageId);
        if (result && result.item) return result.item;
        return result ?? null;
      });
    } catch {
      // Server doesn't support page metadata — return null to fall back to static config
      return null;
    }
  }

  /**
   * Update (upsert) a dashboard definition.
   *
   * Dashboards are control-plane metadata, not data records. Persist via
   * `client.meta.saveItem('dashboard', name, schema)` which routes to
   * `PUT /api/v1/meta/dashboard/:name`. After save, invalidates the
   * relevant metadata cache entry so the next dashboard read reflects
   * the new payload.
   *
   * @param dashboardName - Dashboard identifier (e.g. 'crm_overview_dashboard')
   * @param schema - Full dashboard schema (widgets, layout, etc.)
   */
  async updateDashboard(
    dashboardName: string,
    schema: Record<string, any>
  ): Promise<Record<string, any> | void> {
    await this.connect();
    const result: any = await this.client.meta.saveItem(
      'dashboard',
      dashboardName,
      schema
    );
    // Invalidate dashboards list and any cached dashboard read so the
    // next render reflects the change.
    this.metadataCache.invalidate?.('dashboards');
    this.metadataCache.invalidate?.(`dashboard:${dashboardName}`);
    if (result && result.item) return result.item;
    return result ?? undefined;
  }

  /**
   * Perform server-side aggregation via the ObjectStack analytics API.
   * Uses `this.client.analytics.query()` from @objectstack/client to leverage
   * the SDK's built-in auth, headers, and fetch configuration.
   * Falls back to client-side aggregation via find() if the analytics endpoint
   * is not available.
   */
  async aggregate(resource: string, params: any): Promise<any[]> {
    await this.connect();

    // Spec-shape aggregation: `{ groupBy: GroupByNode[], aggregations: AggregationNode[], where?, limit? }`
    // per spec/data/query.zod.ts. Sent directly to the server's POST
    // /data/:object/query endpoint, which routes through engine.aggregate
    // and returns bucketed rows with the requested aliases.
    const looksLikeSpecShape =
      params != null &&
      (Array.isArray((params as any).groupBy) ||
        Array.isArray((params as any).aggregations) ||
        (params as any).where !== undefined);
    if (looksLikeSpecShape) {
      const queryAst: Record<string, unknown> = {};
      if (Array.isArray(params.groupBy)) queryAst.groupBy = params.groupBy;
      if (Array.isArray(params.aggregations)) queryAst.aggregations = params.aggregations;
      if (params.where !== undefined) queryAst.where = params.where;
      if (typeof params.limit === 'number') queryAst.limit = params.limit;
      const result: any = await this.client.data.query(resource, queryAst as any);
      // client.data.query returns { object, records, total, hasMore }
      if (Array.isArray(result)) return result;
      if (Array.isArray(result?.records)) return result.records;
      if (Array.isArray(result?.data)) return result.data;
      return [];
    }

    try {
      // Build measure name in the format expected by the backend analytics
      // service (memory-analytics / cube).  For 'count' the measure key is
      // simply 'count'; for other aggregation functions it follows the
      // convention `${field}_${function}` (e.g. 'amount_sum').
      const measureName = params.function === 'count'
        ? 'count'
        : `${params.field}_${params.function}`;
      // The column the caller expects the value under — the raw `field`, or the
      // literal `count` when a count names no field (framework#3701). Reading
      // `params.field` directly here keyed the row `undefined` for a fieldless
      // count and deleted the `count` the server sent, so the chart plotted
      // nothing.
      const valueKey = this.aggregateValueKey(params);

      const payload: Record<string, unknown> = {
        cube: resource,
        measures: [measureName],
        // When groupBy is '_all' no dimensions are needed (single-bucket).
        dimensions: params.groupBy && params.groupBy !== '_all' ? [params.groupBy] : [],
      };
      if (params.filter) {
        // Dashboard widgets emit MongoDB-style FilterCondition (per
        // spec/ui/dashboard.zod.ts). Send via the canonical `where`
        // field of the analytics endpoint, matching the unified Query
        // DSL (spec/data/query.zod.ts).
        payload.where = params.filter;
      }

      const data = await this.client.analytics.query(payload);

      const rawRows: any[] = Array.isArray(data) ? data
        : data?.rows && Array.isArray(data.rows) ? data.rows
        : data?.data && Array.isArray(data.data) ? data.data
        : data?.data?.rows && Array.isArray(data.data.rows) ? data.data.rows
        : data?.results && Array.isArray(data.results) ? data.results
        : [];

      // Defensive guard: if the backend silently dropped the requested measure
      // (e.g. it doesn't recognise the `${field}_${function}` alias and the
      // canonical measure is named differently), the rows come back without
      // any measure value. Detect this and fall back to client-side
      // aggregation so charts still render.
      const measureMissing = rawRows.length > 0 && rawRows.every((row: any) => {
        if (row == null) return true;
        if (measureName in row && row[measureName] != null) return false;
        if (valueKey in row && row[valueKey] != null) return false;
        return true;
      });
      if (measureMissing) {
        return await this.aggregateViaFind(resource, params);
      }

      // Map measure keys back to the object-bound result column so consumers
      // (ObjectChart, DashboardRenderer, …) read values by the name the
      // convention promises: `field`, or `count` for a fieldless count
      // (framework#3701). This includes count → field (e.g. 'count' →
      // 'amount'), matching aggregateClientSide()'s output.
      return rawRows.map((row: any) => {
        const mapped = { ...row };
        if (measureName !== valueKey && measureName in mapped) {
          mapped[valueKey] = mapped[measureName];
          delete mapped[measureName];
        }
        return mapped;
      });
    } catch (e) {
      const failure = classifyAnalyticsFailure(e);

      // The server refused OUR body — that is a defect in this adapter's
      // request, not a deployment without the capability. Answering it with
      // the client-side path would produce plausible numbers and bury the
      // contract violation, the misdirection framework#3878 documented.
      if (failure.kind === 'rejected') {
        throw new AnalyticsQueryRejectedError(failure.message, failure.code);
      }

      // The capability is absent (404 — framework#4019 stops mounting the
      // routes when no analytics service is registered — or 501). Say so ONCE
      // so an operator sees a missing capability rather than charts that
      // quietly read from a slower path forever.
      if (failure.kind === 'not-installed') {
        this.warnAnalyticsCapabilityOnce(failure.message);
      }

      // Degrade to find() + client-side aggregation. `aggregateViaFind`
      // forwards the same filter, so the fallback aggregates over the SAME row
      // set the server-side query would have — and `find()` is server-scoped,
      // so RLS still applies.
      return await this.aggregateViaFind(resource, params);
    }
  }

  /**
   * Client-side aggregation over a server-scoped `find()` — the fallback used
   * whenever the analytics endpoint cannot answer (capability absent, network
   * failure, or a result whose measure came back missing).
   *
   * Forwarding `params.filter` is load-bearing: without it the fallback
   * aggregates the whole table while the caller believes it applied a filter,
   * which is the "KPI silently sums everything" failure this adapter has
   * guarded against since the widget filter was threaded through.
   */
  private async aggregateViaFind(resource: string, params: any): Promise<any[]> {
    const result = await this.find(
      resource as any,
      params.filter ? ({ $filter: params.filter } as any) : undefined,
    );
    const records = result.data || [];
    if (records.length === 0) return [];
    return this.aggregateClientSide(records, params);
  }

  /**
   * Say "the analytics capability isn't installed" ONCE per adapter, not once
   * per widget: a dashboard fans out one aggregate() per KPI, and N identical
   * console lines read like N different failures.
   */
  private warnAnalyticsCapabilityOnce(detail?: string): void {
    if (this.analyticsCapabilityWarned) return;
    this.analyticsCapabilityWarned = true;
    console.warn(
      '[OBJECTSTACKDataSource] analytics capability unavailable — aggregating client-side ' +
      'from a scoped find(). Numbers stay correct but the semantic layer (cubes, joins, ' +
      'server-side rollups) is off. Install @objectstack/service-analytics to enable it.' +
      (detail ? ` Server said: ${detail}` : ''),
    );
  }

  /**
   * Run a semantic-layer `dataset` (ADR-0021) and return chart-ready rows.
   *
   * Posts to `POST /api/v1/analytics/dataset/query` (see `@objectstack/rest`
   * `registerAnalyticsEndpoints`). Accepts either a saved dataset name or an
   * inline draft definition — the inline form is what the Studio dataset
   * editor sends to preview an unsaved draft. The adapter's bearer token is
   * forwarded so tenant/RLS scoping (ADR-0021 D-C) is enforced server-side.
   *
   * Unlike {@link aggregate}, this does NOT fall back to client-side
   * aggregation: cross-object joins can only run on the server, so a failure
   * is surfaced to the caller (the preview panel shows the error) rather than
   * silently returning wrong numbers.
   *
   * @param dataset - An inline dataset definition (draft) OR a saved dataset name.
   * @param selection - The spec's {@link DatasetSelection} — dimension/measure
   *   names to project plus runtime directives. This parameter IS the spec type
   *   by reference, never a local restatement of it (objectui#3613): a hand
   *   copy of a contract is a second dialect of it, and the copy this replaced
   *   had already drifted three ways from `@objectstack/spec` — it required
   *   `compareTo.dimension` (optional since objectstack#5011, and resolved by
   *   the EXECUTOR, so requiring it pushed callers into exactly the
   *   consumer-side dimension guess AGENTS.md #0.1 forbids), it widened
   *   `timeDimensions` to `unknown[]` and `runtimeFilter` to
   *   `Record<string, unknown>`, and it had never grown `dateGranularity` at
   *   all. Pinned in `queryDataset.test.ts`.
   */
  async queryDataset(
    dataset: Record<string, unknown> | string,
    selection: DatasetSelection,
  ): Promise<{
    rows: Array<Record<string, unknown>>;
    /**
     * Column metadata — the spec's `AnalyticsResult.fields[]` element BY
     * REFERENCE, never a local restatement of it (objectui#3752). Read
     * `@objectstack/spec` for what a column carries; this comment deliberately
     * does not re-list the keys, because the enumeration it replaced was the
     * bug: it named five (`name`/`type`/`label`/`format`/`currency`) and stopped
     * at the contract of the day it was written, so it never grew
     * `percentScale` — the server's answer to whether a percentage column is a
     * 0–1 fraction or already percentage points. The spec says a renderer that
     * receives it "must scale by it instead of guessing from the value"
     * (objectui#3136), so a declaration that hides the key steers a typed
     * consumer into exactly the guess-by-magnitude the issue banned. Pinned in
     * `queryDataset.test.ts`.
     *
     * Only this element is spec-owned: the envelope around it (`object` /
     * `dimensionFields` / `drillRawRows`) is ADR-0021 D2 drill metadata the REST
     * route adds on top of `AnalyticsResult`, and this method never returns the
     * result's `sql`, so the whole envelope is NOT an `AnalyticsResult`.
     */
    fields: Array<AnalyticsResult['fields'][number]>;
    /** ADR-0021 D2 drill-through: the dataset's base object (records to drill into). */
    object?: string;
    /** Drillable dimension NAME → underlying object FIELD name. */
    dimensionFields?: Record<string, string>;
    /** Raw grouped values per row (aligned to `rows` by index) for drill filters. */
    drillRawRows?: Array<Record<string, unknown>>;
    /**
     * Half-open date-range drill scope per row (framework#1752), aligned to
     * `rows` by index: dimension NAME → the field and `[gte, lt)` bounds of that
     * row's time bucket. The RANGE companion to `drillRawRows`, which handles
     * equality dims only — a `dateGranularity` dimension groups a SPAN of
     * records into one bucket, so the server excludes date dims from
     * `dimensionFields`/`drillRawRows` and sends this sidecar instead.
     *
     * The entry type is `@object-ui/core`'s `DatasetDrillRange` BY REFERENCE,
     * not a local restatement of it (objectui#3613/#3752 discipline): the same
     * declaration is what `buildDatasetDrillFilter` — the single consumer that
     * turns these bounds into an ObjectQL `{ $gte, $lt }` — accepts, and what
     * `DatasetWidget` / `DatasetReportRenderer` type their state with. Nothing
     * in `@objectstack/spec` owns this shape yet (the server's own
     * `AnalyticsResultWithDrill` is local to `service-analytics`), so the shared
     * in-repo interface is the one contract available; restating it here would
     * make a third dialect of it. Like `drillRawRows`, only the ARRAY is
     * validated below — the bounds are unvalidated payload, which is exactly why
     * `DatasetDrillRange` declares them `unknown`.
     */
    drillRanges?: Array<Record<string, DatasetDrillRange>>;
    /** Server-computed marginal aggregates, one entry per requested grouping. */
    totals?: Array<{ dimensions: string[]; rows: Array<Record<string, unknown>> }>;
  }> {
    await this.connect();
    const base = (this.baseUrl || '').replace(/\/$/, '');
    const url = `${base}/api/v1/analytics/dataset/query`;
    // ADR-0037 P3 — draft data preview. Preview mode is URL-keyed by design
    // (`?preview=draft` flips the whole document, incl. the Live Canvas
    // iframe), so the adapter reads it straight off the location rather than
    // threading a React context down through every widget package. When set,
    // the server overlays the pending seed draft's rows on the dataset query
    // and resolves draft-overlaid dataset definitions.
    const previewDrafts =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('preview') === 'draft';
    const requestBody = typeof dataset === 'string'
      ? { datasetName: dataset, selection, ...(previewDrafts ? { previewDrafts: true } : {}) }
      : { dataset, selection, ...(previewDrafts ? { previewDrafts: true } : {}) };

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errBody = await res.json();
        detail = errBody?.message || errBody?.error || JSON.stringify(errBody);
      } catch { /* non-JSON error body */ }
      // "The capability isn't installed" is not a stack trace to show an
      // author (framework#3891): the REST dataset route answers 501
      // NOT_IMPLEMENTED when no analytics service provides `queryDataset`, and
      // a host that doesn't mount the route at all answers 404. Both mean the
      // same thing and both get a message a UI can render verbatim; anything
      // else (a compile error like "relationship not declared in include") is
      // a real authoring error and keeps its server detail.
      if (res.status === 501 || res.status === 404) {
        throw new AnalyticsNotInstalledError('POST /analytics/dataset/query', detail || undefined);
      }
      throw new Error(`Dataset query failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }

    const payload = await res.json();
    // Unwrap the standard `{ success, data }` envelope when present.
    const data = payload && typeof payload === 'object' && 'success' in payload && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;
    const rows = Array.isArray((data as any)?.rows)
      ? (data as any).rows
      : (Array.isArray(data) ? (data as any) : []);
    const fields = Array.isArray((data as any)?.fields) ? (data as any).fields : [];
    // Drill-through metadata (ADR-0021 D2): the server exposes the dataset's
    // base object + drillable dimension→field mapping, plus a parallel array of
    // RAW grouped values (the rows themselves carry display labels), so a host
    // can build an exact-match filter from a clicked bucket.
    const object = typeof (data as any)?.object === 'string' ? (data as any).object : undefined;
    const dimensionFields =
      (data as any)?.dimensionFields && typeof (data as any).dimensionFields === 'object'
        ? ((data as any).dimensionFields as Record<string, string>)
        : undefined;
    const drillRawRows = Array.isArray((data as any)?.drillRawRows) ? (data as any).drillRawRows : undefined;
    // framework#1752 — the date-range sidecar. Dropping it here (objectui#3813)
    // made date-bucket drill-through impossible through the only real adapter:
    // a widget grouped ONLY by a date dimension gets no `dimensionFields` (the
    // server excludes date dims from the equality drill), so `drillRanges` is
    // the ONLY thing that can make `canDrill` true — with the key hand-picked
    // away, the whole drill entry point disappeared, and a mixed grouping
    // drilled to a superset (every bucket, not the clicked one).
    const drillRanges = Array.isArray((data as any)?.drillRanges) ? (data as any).drillRanges : undefined;
    const totals = Array.isArray((data as any)?.totals) ? (data as any).totals : undefined;
    return { rows, fields, object, dimensionFields, drillRawRows, drillRanges, totals };
  }

  /** Client-side aggregation fallback */
  /**
   * The result column an object-bound `aggregate` projects its value under
   * (framework#3701, `chartAggregateValueKey` in `@objectstack/spec/ui`): the
   * raw `field` name — no `sum_`-style decoration, unlike a dataset measure —
   * or the literal `count` when a count names no field.
   */
  private aggregateValueKey(params: { field?: string; function?: string }): string {
    return params.field || params.function || 'count';
  }

  private aggregateClientSide(records: any[], params: { field?: string; function: string; groupBy: string }): any[] {
    const { field, function: aggFn, groupBy } = params;
    const valueKey = this.aggregateValueKey(params);
    const groups: Record<string, any[]> = {};

    for (const record of records) {
      const key = String(record[groupBy] ?? 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }

    return Object.entries(groups).map(([key, group]) => {
      const values = field ? group.map(r => Number(r[field]) || 0) : [];
      let result: number;

      switch (aggFn) {
        case 'count': result = group.length; break;
        case 'avg': result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
        case 'min': result = values.length > 0 ? Math.min(...values) : 0; break;
        case 'max': result = values.length > 0 ? Math.max(...values) : 0; break;
        case 'sum': default: result = values.reduce((a, b) => a + b, 0); break;
      }

      return { [groupBy]: key, [valueKey]: result };
    });
  }

  /**
   * Get multiple metadata items from ObjectStack.
   * Uses v3.0.0 metadata API pattern: getItems for batch retrieval.
   */
  async getItems(category: string, names: string[]): Promise<unknown[]> {
    await this.connect();
    
    const results = await Promise.all(
      names.map(async (name) => {
        const cacheKey = `${category}:${name}`;
        return this.metadataCache.get(cacheKey, async () => {
          const result: any = await this.client.meta.getItem(category, name);
          if (result && result.item) return result.item;
          return result;
        });
      })
    );
    
    return results;
  }

  /**
   * Get cached metadata if available, without triggering a fetch.
   * Uses v3.0.0 metadata API pattern: getCached for synchronous cache access.
   */
  getCached(key: string): unknown | undefined {
    return this.metadataCache.getCachedSync(key);
  }

  /**
   * Get cache statistics for monitoring performance.
   */
  getCacheStats() {
    return this.metadataCache.getStats();
  }

  /**
   * Invalidate metadata cache entries.
   * 
   * @param key - Optional key to invalidate. If omitted, invalidates all entries.
   */
  invalidateCache(key?: string): void {
    this.metadataCache.invalidate(key);
  }

  /**
   * Clear all cache entries and statistics.
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Upload a single file to a resource.
   * Posts the file as multipart/form-data to the ObjectStack server.
   *
   * @param resource - The resource/object name to attach the file to
   * @param file - File object or Blob to upload
   * @param options - Additional upload options (recordId, fieldName, metadata)
   * @returns Promise resolving to the upload result (file URL, metadata)
   */
  async uploadFile(
    resource: string,
    file: File | Blob,
    options?: {
      recordId?: string;
      fieldName?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (percent: number) => void;
    },
  ): Promise<FileUploadResult> {
    await this.connect();

    const formData = new FormData();
    formData.append('file', file);

    if (options?.recordId) {
      formData.append('recordId', options.recordId);
    }
    if (options?.fieldName) {
      formData.append('fieldName', options.fieldName);
    }
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const url = `${this.baseUrl}/api/data/${encodeURIComponent(resource)}/upload`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        ...(this.getAuthHeaders()),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ObjectStackError(
        error.message || `Upload failed with status ${response.status}`,
        'UPLOAD_ERROR',
        response.status,
      );
    }

    return response.json();
  }

  /**
   * Upload multiple files to a resource.
   * Posts all files as a single multipart/form-data request.
   *
   * @param resource - The resource/object name to attach the files to
   * @param files - Array of File objects or Blobs to upload
   * @param options - Additional upload options
   * @returns Promise resolving to array of upload results
   */
  async uploadFiles(
    resource: string,
    files: (File | Blob)[],
    options?: {
      recordId?: string;
      fieldName?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (percent: number) => void;
    },
  ): Promise<FileUploadResult[]> {
    await this.connect();

    const formData = new FormData();
    files.forEach((file, idx) => {
      formData.append(`files`, file, (file as File).name || `file-${idx}`);
    });

    if (options?.recordId) {
      formData.append('recordId', options.recordId);
    }
    if (options?.fieldName) {
      formData.append('fieldName', options.fieldName);
    }
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const url = `${this.baseUrl}/api/data/${encodeURIComponent(resource)}/upload`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        ...(this.getAuthHeaders()),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ObjectStackError(
        error.message || `Upload failed with status ${response.status}`,
        'UPLOAD_ERROR',
        response.status,
      );
    }

    return response.json();
  }

  /**
   * Cancel (recall) the active pending approval request for a given record.
   *
   * Looks up the most recent `sys_approval_request` for the (object, record)
   * pair whose status is `pending` or `in_approval`, then issues a POST to
   * `/api/v1/approvals/requests/:id/recall`. The submitter is the only role
   * permitted to recall on the server — non-submitters will receive a 403.
   *
   * On success, the backend mirrors `approval_status = 'recalled'` onto the
   * source record so the lock badge disappears on next fetch.
   */
  async cancelPendingApproval(
    objectName: string,
    recordId: string,
  ): Promise<{ requestId: string; status: string }> {
    await this.connect();

    // Use the approvals service REST endpoint directly. The generic
    // `/api/v1/data/sys_approval_request` route applies record-sharing
    // ACLs that the approvals collection isn't always registered for,
    // so prefer the cross-cutting `/approvals/requests` endpoint which
    // is owned by the approvals service itself.
    const listUrl = `${this.baseUrl}/api/v1/approvals/requests?recordId=${encodeURIComponent(recordId)}&object=${encodeURIComponent(objectName)}`;
    const listRes = await this.fetchImpl(listUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
    });
    if (!listRes.ok) {
      throw new ObjectStackError(
        `Failed to look up approval requests (status ${listRes.status})`,
        'APPROVAL_LOOKUP_FAILED',
        listRes.status,
      );
    }
    const listBody: any = await listRes.json().catch(() => ({}));
    const rows: any[] = Array.isArray(listBody) ? listBody : (listBody?.data ?? []);
    const pending = rows.find(
      (r) => r?.status === 'pending' || r?.status === 'in_approval',
    );
    if (!pending?.id) {
      throw new ObjectStackError(
        'No pending approval request found for this record',
        'NO_PENDING_REQUEST',
        404,
      );
    }

    const url = `${this.baseUrl}/api/v1/approvals/requests/${encodeURIComponent(pending.id)}/recall`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new ObjectStackError(
        err?.error || err?.message || `Recall failed with status ${response.status}`,
        err?.code || 'APPROVAL_RECALL_FAILED',
        response.status,
      );
    }
    const body: any = await response.json().catch(() => ({}));
    return { requestId: pending.id, status: body?.data?.request?.status ?? 'recalled' };
  }

  /**
   * Get authorization headers from the adapter config.
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }
}

/**
 * Factory function to create an ObjectStack data source.
 * 
 * @example
 * ```typescript
 * const dataSource = createObjectStackAdapter({
 *   baseUrl: process.env.API_URL,
 *   token: process.env.API_TOKEN,
 *   cache: { maxSize: 100, ttl: 300000 },
 *   autoReconnect: true,
 *   maxReconnectAttempts: 5
 * });
 * ```
 */
export function createObjectStackAdapter<T = unknown>(config: {
  baseUrl: string;
  token?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  cache?: {
    maxSize?: number;
    ttl?: number;
  };
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}): DataSource<T> {
  return new ObjectStackAdapter<T>(config);
}

// Export error classes for error handling
export {
  ObjectStackError,
  MetadataNotFoundError,
  BulkOperationError,
  ConnectionError,
  AuthenticationError,
  DataApiValidationError,
  createErrorFromResponse,
  isObjectStackError,
  isErrorType,
} from './errors';

// Export cache types
export type { MetadataCacheStats } from './cache/MetadataCache';

// v3.0.0 Deep Integration modules
// (The cloud deployment/hosting/marketplace surface that used to be re-exported
// here was retired by objectui#4152 — it called into a client namespace that
// does not exist and fabricated success. `cloud-surface-retired-4152.pin.test.ts`
// fails if it returns; that file names the retired symbols, this one must not.)
export { validatePluginContract, generateContractManifest } from './contracts';

// User-scoped persistence adapter (favorites / recent items / …)
export { createObjectStackUserStateAdapter } from './userState';
export type {
  ObjectStackUserStateAdapterOptions,
  UserDataAdapter,
} from './userState';
export type { PluginContract, PluginExport, PluginAPIContract, ContractValidationResult, ContractValidationError } from './contracts';

export { IntegrationManager } from './integration';
export type { IntegrationConfig, IntegrationTrigger, IntegrationProvider, SlackIntegrationConfig, EmailIntegrationConfig, WebhookIntegrationConfig } from './integration';

// Metadata API client — read/write protocol metadata via /api/v1/meta/*.
// Used by plugin-designer to back the Setup-app Object Manager and Field
// Designer surfaces; kept separate from ObjectStackAdapter so callers
// can use it without the full data-source surface.
export { MetadataClient, readSaveAdvisories } from './metadata-client';
export type {
  RuntimeAuthoringIssue,
  MetadataSaveAdvisoryEvent,
  MetadataSaveAdvisoryListener,
  MetadataClientConfig,
  MetadataListOptions,
  MetadataDraftHeader,
  MetadataClientSaveOptions,
  MetadataGetOptions,
  MetadataDeleteOptions,
  MetadataHistoryOptions,
  MetadataError,
  MetadataValidationIssue,
  MetadataLayered,
  MetadataReference,
  MetadataDiagnostics,
  MetadataDiagnosticsOptions,
  MetadataDiagnosticsEntry,
  MetadataDiagnosticsSummary,
  MetadataAuditEntry,
  MetadataAuditResponse,
} from './metadata-client';

export { SecurityManager } from './security';
export type { SecurityManagerPolicy, CSPConfig, AuditLogConfig, AuditEventType, DataMaskingConfig, DataMaskingRule, AuditLogEntry } from './security';

export { createDefaultCanvasConfig, snapToGrid, calculateAutoLayout } from './studio';
export type { StudioCanvasConfig, StudioPropertyEditor, StudioThemeBuilderConfig, StudioColorPalette, StudioTypographyPreset, StudioShadowPreset } from './studio';
