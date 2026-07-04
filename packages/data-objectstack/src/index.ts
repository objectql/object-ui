/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ObjectStackClient, type QueryOptions as ObjectStackQueryOptions } from '@objectstack/client';
import type {
  DataSource,
  MutationEvent,
  QueryParams,
  QueryResult,
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
import { convertFiltersToAST } from '@object-ui/core';
import { MetadataCache } from './cache/MetadataCache';
import {
  ObjectStackError,
  MetadataNotFoundError,
  BulkOperationError,
  ConnectionError,
  createErrorFromResponse,
} from './errors';

/**
 * Map human-readable filter operator names produced by SDUI view configs
 * (e.g. `lead.view.ts`) to the canonical operator symbols expected by the
 * ObjectStack server's filter AST. Unknown operators fall through unchanged
 * so existing AST-style entries keep working.
 */
const FILTER_OPERATOR_ALIASES: Record<string, string> = {
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
};

function normalizeFilterOperator(op: unknown): string | null {
  if (typeof op !== 'string') return null;
  const lower = op.toLowerCase();
  return FILTER_OPERATOR_ALIASES[lower] ?? FILTER_OPERATOR_ALIASES[op] ?? op;
}

function objectFilterEntryToAST(entry: any): [string, string, any] | null {
  if (!entry || typeof entry !== 'object') return null;
  const field = entry.field ?? entry.name;
  const rawOp = entry.operator ?? entry.op ?? '=';
  const op = normalizeFilterOperator(rawOp);
  if (!field || !op) return null;
  return [String(field), op, entry.value];
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

    // Object form: [{ field, operator, value }, ...]
    const first = filter[0];
    const isObjectForm = filter.length > 0
      && typeof first === 'object'
      && first !== null
      && !Array.isArray(first)
      && (first as any).field !== undefined;
    if (isObjectForm) {
      const tuples = (filter as any[])
        .map(entry => objectFilterEntryToAST(entry))
        .filter((t): t is [string, string, any] => t !== null);
      if (tuples.length === 0) return undefined;
      if (tuples.length === 1) return tuples[0];
      return ['and', ...tuples];
    }

    // Already AST — pass through.
    return filter;
  }

  if (typeof filter === 'object') {
    if (Object.keys(filter as Record<string, unknown>).length === 0) return undefined;
    return filter;
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
  return code === 'object_not_found' || code === 'record_not_found';
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
 * Convert any error thrown by the upstream client into a typed
 * `ConcurrentUpdateError` when it represents a 409 CONCURRENT_UPDATE.
 * Returns the original error untouched otherwise. Callers can simply
 * `throw normaliseClientError(err)` from their catch blocks.
 */
export function normaliseClientError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;
  const e = error as Record<string, unknown>;
  if (e.code !== 'CONCURRENT_UPDATE' && e.httpStatus !== 409) return error;
  if (e.code !== 'CONCURRENT_UPDATE') return error;
  const details = (e.details ?? {}) as Record<string, unknown>;
  return new ConcurrentUpdateError({
    currentVersion: typeof details.currentVersion === 'string' ? details.currentVersion : null,
    currentRecord: details.currentRecord ?? null,
    message: typeof e.message === 'string' ? e.message : undefined,
  });
}

/**
 * Build a Logger compatible with @objectstack/client that demotes expected
 * 404 noise to console.debug. The client logs every non-2xx response with
 * `logger.error("HTTP request failed", undefined, { status, error })`, but
 * 404s on optional collections (sys_presence, sys_activity, …) are part of
 * normal degraded operation when those plugins aren't installed on the
 * server — they should not surface as errors in the browser DevTools.
 *
 * Returned object is loosely typed because the spec's Logger interface lives
 * in a transitive package; using `any` keeps us decoupled.
 */
function createQuietHttpLogger(): any {
  const isExpected404 = (meta?: Record<string, any>): boolean => {
    if (!meta || typeof meta !== 'object') return false;
    if (meta.status === 404 || meta.statusCode === 404) return true;
    const errBody = meta.error;
    if (errBody && typeof errBody === 'object') {
      const code = (errBody as Record<string, unknown>).code;
      if (code === 'object_not_found' || code === 'record_not_found') return true;
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
        console.debug(`[ObjectStack] ${message} (suppressed expected 404)`, meta);
        return;
      }
      console.error(message, error ?? '', meta ?? '');
    },
    fatal: (message: string, error?: Error, meta?: Record<string, any>) =>
      console.error(message, error ?? '', meta ?? ''),
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
  // Subscribers registered via onMutation(). Emitted after each successful
  // create/update/delete so data-bound views (ListView, ObjectView, kanban,
  // calendar) auto-refresh — the interface ListView relies on to reflect
  // inline-edit "Save All" writes without a manual reload.
  private mutationListeners = new Set<(event: MutationEvent<T>) => void>();

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
  private emitMutation(event: MutationEvent<T>): void {
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
  onMutation(callback: (event: MutationEvent<T>) => void): () => void {
    this.mutationListeners.add(callback);
    return () => {
      this.mutationListeners.delete(callback);
    };
  }

  async create(resource: string, data: Partial<T>): Promise<T> {
    await this.connect();
    const result = await this.client.data.create<T>(resource, data);
    this.emitMutation({ type: 'create', resource, record: { ...result.record } });
    return result.record;
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
      if (result.deleted) {
        this.emitMutation({ type: 'delete', resource, id });
      }
      return result.deleted;
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
   * Cross-object transactional batch (ObjectStack #1604). Runs the operations
   * in ONE server transaction — commit all or roll back all. A field value of
   * `{ $ref: <earlier op index> }` resolves to that op's created id, so a child
   * can reference its parent created earlier in the same batch (master-detail).
   */
  async batchTransaction(
    operations: Array<{ object: string; action?: 'create' | 'update' | 'delete'; data?: any; id?: string }>,
  ): Promise<{ results: any[] }> {
    const url = `${this.baseUrl}/api/v1/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      // Send the session cookie too: in the browser console auth is cookie-based
      // (no bearer `token`), so without `credentials: 'include'` this raw fetch
      // is unauthenticated — every master-detail batch save would 401. Bearer
      // (server-to-server) and cookie (console) auth now both work.
      credentials: 'include',
      body: JSON.stringify({ operations }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ObjectStackError(
        error.error || error.message || `Batch failed with status ${response.status}`,
        'BATCH_ERROR',
        response.status,
      );
    }
    return response.json();
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
    if (params.$orderby) {
      if (Array.isArray(params.$orderby)) {
        const sortStr = params.$orderby.map(item => {
          if (typeof item === 'string') return item;
          const field = item.field;
          const order = item.order || 'asc';
          return order === 'desc' ? `-${field}` : field;
        }).join(',');
        queryParams.set('sort', sortStr);
      } else {
        const sortStr = Object.entries(params.$orderby)
          .map(([field, order]) => order === 'desc' ? `-${field}` : field)
          .join(',');
        queryParams.set('sort', sortStr);
      }
    }

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
          const isObjectForm = params.$filter.length > 0
            && typeof params.$filter[0] === 'object'
            && !Array.isArray(params.$filter[0])
            && (params.$filter[0] as any).field !== undefined;
          if (isObjectForm) {
            const tuples = (params.$filter as any[])
              .map(entry => objectFilterEntryToAST(entry))
              .filter((t): t is [string, string, any] => t !== null);
            if (tuples.length === 0) {
              // All entries were unrecognized — drop the filter rather than
              // sending a malformed array.
            } else if (tuples.length === 1) {
              options.filters = tuples[0];
            } else {
              options.filters = ['and', ...tuples];
            }
          } else {
            // Already in AST format
            options.filters = params.$filter;
          }
        } else {
          options.filters = convertFiltersToAST(params.$filter);
        }
      }
    }

    // Sorting - convert to ObjectStack format
    if (params.$orderby) {
      if (Array.isArray(params.$orderby)) {
        // Handle array format ['name', '-age'] or [{ field: 'name', order: 'asc' }]
        options.sort = params.$orderby.map(item => {
          if (typeof item === 'string') return item;
          // Handle object format { field: 'name', order: 'desc' }
          const field = item.field;
          const order = item.order || 'asc';
          return order === 'desc' ? `-${field}` : field;
        });
      } else {
        // Handle Record format { name: 'asc', age: 'desc' }
        const sortArray = Object.entries(params.$orderby).map(([field, order]) => {
          return order === 'desc' ? `-${field}` : field;
        });
        options.sort = sortArray;
      }
    }

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
   * Per-view runtime overrides (density, column widths, sort, …) are
   * stored in the metadata registry under key `<objectName>/<viewName>`.
   * Loading them per-view fires N HTTP GETs that return 404 for views
   * the user has never customized — generates console noise on every
   * page load. This batch method performs a single
   * `GET /api/v1/meta/<objectName>` (returns `{type, items}`) and
   * returns a `{viewName: override}` map. Returns an empty map if the
   * server doesn't expose the listing or returns no items.
   *
   * Result is cached identically to {@link getView}; saving a view via
   * {@link updateViewConfig} invalidates the cache.
   *
   * @param objectName - Object name (e.g. 'lead')
   * @returns Map keyed by view name with the persisted override config
   */
  async listViewOverrides(objectName: string): Promise<Record<string, any>> {
    await this.connect();

    try {
      const cacheKey = `view-overrides:${objectName}`;
      return await this.metadataCache.get(cacheKey, async () => {
        const result: any = await this.client.meta.getItems(objectName);
        const items: any[] = Array.isArray(result?.items) ? result.items : [];
        const out: Record<string, any> = {};
        for (const it of items) {
          if (!it || typeof it !== 'object') continue;
          const key = it.name ?? it.id ?? it._name;
          if (typeof key === 'string' && key) out[key] = it;
        }
        return out;
      });
    } catch {
      return {};
    }
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
    try {
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
      this.metadataCache.invalidate?.(`views:${objectName}`);
      if (result && result.item) return result.item;
      return result ?? undefined;
    } catch (err) {
      // Surface the error so the caller can decide whether to toast/log;
      // we don't swallow it here because persistence failures are
      // operationally meaningful (unlike read fallbacks).
      throw err;
    }
  }

  /**
   * List user-created views for a given object via the metadata overlay
   * API (ADR-0005). Replaces the legacy `find('sys_view', {...})` path
   * that wrote to a physical `sys_view` table whose columns no longer
   * match the view spec shape.
   *
   * Returns view spec objects with their canonical `name` as identifier.
   * Filters by `data.object === objectName` (or top-level `object`)
   * client-side because the metadata index is name-only, not field-typed.
   */
  async listViews(objectName: string): Promise<any[]> {
    await this.connect();
    try {
      const result: any = await this.client.meta.getItems('view');
      const items: any[] = Array.isArray(result?.items)
        ? result.items
        : Array.isArray(result) ? result : [];
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
        const obj = spec?.data?.object ?? spec?.object ?? spec?.objectName;
        if (obj !== objectName) return false;
        const viewKind = v.viewKind ?? spec?.viewKind;
        return !(viewKind && FORM_FAMILY.has(viewKind));
      }).map((v: any) => {
        const spec = v.list ?? v;
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
          };
        }
        return spec;
      });
    } catch (err) {
      console.warn('[OBJECTSTACKDataSource] listViews failed:', err);
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
    try {
      const result: any = await this.client.meta.saveItem('view', name, fullSpec);
      this.metadataCache.invalidate?.(`views:${objectName}`);
      if (result && result.item) return result.item;
      return fullSpec;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Apply a partial update to an existing overlay view. Reads the current
   * overlay (or seeds from artifact), merges, and writes back. ADR-0005
   * overlay rows store the *full* view document, so partial updates require
   * a read-merge-write cycle.
   */
  async updateView(
    objectName: string,
    viewName: string,
    partial: Record<string, any>,
  ): Promise<Record<string, any> | void> {
    await this.connect();
    let current: any = {};
    try {
      const r: any = await this.client.meta.getItem('view', viewName);
      current = (r && (r.item || r)) || {};
      // Some endpoints return the bare item; others wrap as {type,name,item}
      if (current?.list) current = current.list;
    } catch {
      // Treat missing as create-equivalent
    }
    const merged = {
      ...current,
      ...partial,
      name: viewName,
      object: current?.object || (current as any)?.data?.object || objectName,
    };
    try {
      const result: any = await this.client.meta.saveItem('view', viewName, merged);
      this.metadataCache.invalidate?.(`views:${objectName}`);
      this.metadataCache.invalidate?.(`view:${objectName}:${viewName}`);
      if (result && result.item) return result.item;
      return merged;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Delete an overlay view (reset to artifact default if one exists, or
   * remove entirely if it was a user-created view). Routes to
   * `DELETE /api/v1/meta/view/:name`.
   */
  async deleteView(
    objectName: string,
    viewName: string,
  ): Promise<{ deleted: boolean }> {
    await this.connect();
    try {
      const result: any = await this.client.meta.deleteItem('view', viewName);
      this.metadataCache.invalidate?.(`views:${objectName}`);
      this.metadataCache.invalidate?.(`view:${objectName}:${viewName}`);
      return { deleted: !!(result?.deleted ?? result?.reset ?? true) };
    } catch (err) {
      throw err;
    }
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
    try {
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
    } catch (err) {
      throw err;
    }
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
        if (params.field in row && row[params.field] != null) return false;
        return true;
      });
      if (measureMissing) {
        const result = await this.find(resource as any, params.filter ? { $filter: params.filter } as any : undefined);
        const records = result.data || [];
        if (records.length === 0) return [];
        return this.aggregateClientSide(records, params);
      }

      // Map measure keys back to the original field name so that consumers
      // (ObjectChart, DashboardRenderer, etc.) can access values by field name.
      // This includes count → field (e.g. 'count' → 'amount') to match the
      // output format of aggregateClientSide() which always uses params.field.
      return rawRows.map((row: any) => {
        const mapped = { ...row };
        if (measureName !== params.field && measureName in mapped) {
          mapped[params.field] = mapped[measureName];
          delete mapped[measureName];
        }
        return mapped;
      });
    } catch {
      // If the analytics endpoint is not available, fall back to
      // find() + client-side aggregation. Crucially, forward the same
      // filter so the fallback aggregates over the SAME row set the
      // server-side analytics query would have — otherwise the KPI
      // silently sums the whole table and lies to the user.
      const result = await this.find(resource as any, params.filter ? { $filter: params.filter } as any : undefined);
      const records = result.data || [];
      if (records.length === 0) return [];

      return this.aggregateClientSide(records, params);
    }
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
   * @param selection - Dimension/measure names to project + runtime directives.
   */
  async queryDataset(
    dataset: Record<string, unknown> | string,
    selection: {
      dimensions?: string[];
      measures: string[];
      runtimeFilter?: Record<string, unknown>;
      timeDimensions?: unknown[];
      compareTo?: { kind: 'previousPeriod' | 'previousYear'; dimension: string };
      order?: Record<string, 'asc' | 'desc'>;
      limit?: number;
      offset?: number;
      timezone?: string;
      /** Marginal-aggregate groupings (e.g. `[rows, [colDim], []]`) — server
       *  computes each subtotal with the measure's TRUE aggregate (never client
       *  re-derived). `[]` is the grand total. */
      totals?: { groupings: string[][] };
    },
  ): Promise<{
    rows: Array<Record<string, unknown>>;
    /** Column metadata: a display `label` (dimensions and measures), and a
     *  measure's numeral `format` + declared `currency` for value formatting. */
    fields: Array<{ name: string; type: string; label?: string; format?: string; currency?: string }>;
    /** ADR-0021 D2 drill-through: the dataset's base object (records to drill into). */
    object?: string;
    /** Drillable dimension NAME → underlying object FIELD name. */
    dimensionFields?: Record<string, string>;
    /** Raw grouped values per row (aligned to `rows` by index) for drill filters. */
    drillRawRows?: Array<Record<string, unknown>>;
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
    const totals = Array.isArray((data as any)?.totals) ? (data as any).totals : undefined;
    return { rows, fields, object, dimensionFields, drillRawRows, totals };
  }

  /** Client-side aggregation fallback */
  private aggregateClientSide(records: any[], params: { field: string; function: string; groupBy: string }): any[] {
    const { field, function: aggFn, groupBy } = params;
    const groups: Record<string, any[]> = {};

    for (const record of records) {
      const key = String(record[groupBy] ?? 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }

    return Object.entries(groups).map(([key, group]) => {
      const values = group.map(r => Number(r[field]) || 0);
      let result: number;

      switch (aggFn) {
        case 'count': result = group.length; break;
        case 'avg': result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
        case 'min': result = values.length > 0 ? Math.min(...values) : 0; break;
        case 'max': result = values.length > 0 ? Math.max(...values) : 0; break;
        case 'sum': default: result = values.reduce((a, b) => a + b, 0); break;
      }

      return { [groupBy]: key, [field]: result };
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
  ValidationError,
  createErrorFromResponse,
  isObjectStackError,
  isErrorType,
} from './errors';

// Export cache types
export type { CacheStats } from './cache/MetadataCache';

// v3.0.0 Deep Integration modules
export { CloudOperations } from './cloud';
export type { CloudDeploymentConfig, CloudHostingConfig, CloudMarketplaceEntry } from './cloud';

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
export { MetadataClient } from './metadata-client';
export type {
  MetadataClientConfig,
  MetadataListOptions,
  MetadataDraftHeader,
  MetadataSaveOptions,
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
export type { SecurityPolicy, CSPConfig, AuditLogConfig, AuditEventType, DataMaskingConfig, DataMaskingRule, AuditLogEntry } from './security';

export { createDefaultCanvasConfig, snapToGrid, calculateAutoLayout } from './studio';
export type { StudioCanvasConfig, StudioPropertyEditor, StudioThemeBuilderConfig, StudioColorPalette, StudioTypographyPreset, StudioShadowPreset } from './studio';
