/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Data Source Types
 * 
 * Type definitions for data fetching and management.
 * These interfaces define the universal adapter pattern for data access.
 * 
 * @module data
 * @packageDocumentation
 */

/**
 * Query parameters for data fetching.
 * Follows OData/REST conventions for universal compatibility.
 */
export interface QueryParams {
  /**
   * Fields to select (projection)
   * @example ['id', 'name', 'email']
   */
  $select?: string[];

  /**
   * Filter expression
   * @example { age: { $gt: 18 }, status: 'active' }
   */
  $filter?: Record<string, any>;

  /**
   * Sort order
   * Can be a Map { field: 'asc' }, an Array of strings ['field', '-field'], or Array of sort objects
   * @example { createdAt: 'desc', name: 'asc' }
   * @example ['name', '-createdAt']
   */
  $orderby?: Record<string, 'asc' | 'desc'> | string[] | Array<{ field: string; order?: 'asc' | 'desc' }>;

  /**
   * Number of records to skip (for pagination)
   */
  $skip?: number;

  /**
   * Maximum number of records to return
   */
  $top?: number;

  /**
   * Related entities to expand/include
   * @example ['author', 'comments']
   */
  $expand?: string[];

  /**
   * Search query (full-text search)
   */
  $search?: string;

  /**
   * Optional override of which fields `$search` matches (ADR-0061).
   * The server intersects this with the object's allowed searchable set and
   * ignores anything outside it — it can only *narrow*, never widen, the
   * server-resolved default (`object.searchableFields`). Omit to let the server
   * resolve fields from metadata (the normal case).
   */
  $searchFields?: string[];

  /**
   * Total count of records (for pagination)
   */
  $count?: boolean;

  /**
   * Additional custom parameters
   */
  [key: string]: any;
}

/**
 * Query result with pagination metadata
 */
export interface QueryResult<T = any> {
  /**
   * Result data array
   */
  data: T[];

  /**
   * Total number of records (if requested)
   */
  total?: number;

  /**
   * Current page number (1-indexed)
   */
  page?: number;

  /**
   * Page size
   */
  pageSize?: number;

  /**
   * Whether there are more records
   */
  hasMore?: boolean;

  /**
   * Cursor for cursor-based pagination
   */
  cursor?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Result of a file upload operation.
 */
export interface FileUploadResult {
  /** Server-assigned unique ID for the uploaded file */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type of the uploaded file */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Public URL to access the file */
  url: string;
  /** Thumbnail URL (for images) */
  thumbnailUrl?: string;
  /** Additional server-side metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A `{ $ref: n }` placeholder inside a {@link BatchTransactionOperation}'s
 * `data`. Resolves to the id created by operation `n` (which must appear
 * earlier in the same batch) — used to link a child to a parent created in
 * the same transaction (master-detail create).
 */
export interface BatchRef {
  $ref: number;
}

/**
 * One operation in a cross-object transactional batch. Field names match the
 * server contract of `POST /api/v1/batch` (ObjectStack framework #1604 /
 * ADR-0034 item 4).
 *
 * Distinct from the driver-level `BatchOperation` in `data-protocol.ts`
 * (which speaks `type`/`table`) — this is the DataSource-level, object-aware
 * shape consumed by {@link DataSource.batchTransaction}.
 */
export interface BatchTransactionOperation {
  /** Target object/table name. */
  object: string;
  /** Operation to perform — defaults to `'create'` when omitted. */
  action?: 'create' | 'update' | 'delete';
  /** Target record id — required for `update` and `delete`. */
  id?: string;
  /**
   * Write payload for `create`/`update`. A value may be a
   * `{ $ref: <earlier op index> }` placeholder (see {@link BatchRef}).
   */
  data?: Record<string, any>;
}

/**
 * Universal data source interface.
 * This is the core abstraction that makes Object UI backend-agnostic.
 * 
 * Implementations can connect to:
 * - REST APIs
 * - GraphQL endpoints
 * - ObjectQL servers
 * - Firebase/Supabase
 * - Local arrays/JSON
 * - Any data source
 * 
 * @template T - The data type
 * 
 * @example
 * ```typescript
 * class RestDataSource implements DataSource<User> {
 *   async find(resource, params) {
 *     const response = await fetch(`/api/${resource}?${buildQuery(params)}`);
 *     return response.json();
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface DataSource<T = any> {
  /**
   * Fetch multiple records.
   * 
   * @param resource - Resource name (e.g., 'users', 'posts')
   * @param params - Query parameters
   * @returns Promise resolving to query result
   */
  find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;

  /**
   * Fetch a single record by ID.
   * 
   * @param resource - Resource name
   * @param id - Record identifier
   * @param params - Additional query parameters
   * @returns Promise resolving to the record or null
   */
  findOne(resource: string, id: string | number, params?: QueryParams): Promise<T | null>;

  /**
   * Create a new record.
   * 
   * @param resource - Resource name
   * @param data - Record data
   * @returns Promise resolving to the created record
   */
  create(resource: string, data: Partial<T>): Promise<T>;

  /**
   * Update an existing record.
   *
   * @param resource - Resource name
   * @param id - Record identifier
   * @param data - Updated data (partial)
   * @param opts - Optional write options. Pass `opts.ifMatch` to enable
   *   Optimistic Concurrency Control: the implementation forwards the
   *   token (typically the `updated_at` value the caller previously read)
   *   to the server. On a mismatch the adapter rejects with a
   *   `ConcurrentUpdateError` (HTTP 409) so the UI can surface a
   *   conflict-resolution flow. Adapters that don't support OCC may
   *   ignore the option.
   * @returns Promise resolving to the updated record
   */
  update(
    resource: string,
    id: string | number,
    data: Partial<T>,
    opts?: { ifMatch?: string },
  ): Promise<T>;

  /**
   * Delete a record.
   *
   * @param resource - Resource name
   * @param id - Record identifier
   * @param opts - Optional write options — see {@link update} for `ifMatch`.
   * @returns Promise resolving to true if successful
   */
  delete(
    resource: string,
    id: string | number,
    opts?: { ifMatch?: string },
  ): Promise<boolean>;

  /**
   * Execute a bulk operation (optional).
   * 
   * @param resource - Resource name
   * @param operation - Operation type
   * @param data - Bulk data
   * @returns Promise resolving to operation result
   */
  bulk?(resource: string, operation: 'create' | 'update' | 'delete', data: Partial<T>[]): Promise<T[]>;

  /**
   * Apply the **same** patch to many records in a single round-trip.
   *
   * This is the "Slack mark-all-as-read" / "Linear archive selection"
   * pattern: one logical operation, N targets, identical body. Adapters
   * that support a server-side bulk-update primitive should issue one
   * HTTP request; adapters without bulk support may fall back to a
   * sequential per-id loop (callers should not assume atomicity).
   *
   * Returns the count of successfully updated rows. Per-row failures
   * (e.g. RLS-rejected, validation errors) are tolerated when the
   * adapter supports it; total errors throw.
   *
   * @param resource - Object/table name
   * @param ids - Target record ids
   * @param patch - Field updates applied uniformly to every id
   * @returns Number of rows reported as updated by the server
   */
  bulkUpdate?(
    resource: string,
    ids: ReadonlyArray<string | number>,
    patch: Partial<T>,
  ): Promise<number>;

  /**
   * Bulk delete multiple records by id in a single server call.
   *
   * Symmetric counterpart to `bulkUpdate` — collapses a "delete N rows"
   * intent into 1 HTTP request. Adapters that support a server-side
   * delete primitive should issue one DELETE call; adapters without
   * bulk support may fall back to a sequential per-id loop (callers
   * should not assume atomicity).
   *
   * Returns the count of successfully deleted rows. Per-row failures
   * (e.g. RLS-rejected, foreign-key constraint) are tolerated when the
   * adapter supports it; total errors throw.
   *
   * @param resource - Object/table name
   * @param ids - Target record ids
   * @returns Number of rows reported as deleted by the server
   */
  bulkDelete?(
    resource: string,
    ids: ReadonlyArray<string | number>,
  ): Promise<number>;

  /**
   * Atomically persist an ordered set of cross-object operations (optional).
   *
   * Contract: **either every operation commits or none do**. `results` is
   * index-aligned with `operations` — a create/update echoes the written
   * record, a delete echoes `true`. A field value inside an op's `data` may
   * be a `{ $ref: <earlier op index> }` placeholder (see {@link BatchRef})
   * that resolves to the id produced by that earlier operation, so a child
   * row can reference a parent created in the SAME batch (master-detail).
   *
   * Backends with a transactional batch endpoint should issue one server
   * call (true atomicity). Adapters WITHOUT server-side atomicity must still
   * implement this method by emulating it client-side with best-effort
   * compensation — see `emulateBatchTransaction` in `@object-ui/core`.
   * Callers may therefore assume this method always saves, but only a
   * server-backed implementation is genuinely atomic.
   *
   * @param operations - Ordered cross-object operations
   * @returns `{ results }` index-aligned with `operations`
   */
  batchTransaction?(
    operations: BatchTransactionOperation[],
  ): Promise<{ results: any[] }>;

  /**
   * Cancel (recall) the active pending approval request for a record.
   * Returns the recalled request id and final status. Throws when no
   * pending request exists or when the caller is not the submitter.
   *
   * Optional — adapters that don't speak to an approvals service can omit it.
   */
  cancelPendingApproval?(
    objectName: string,
    recordId: string,
  ): Promise<{ requestId: string; status: string }>;

  /**
   * Get object schema/metadata.
   * Used by ObjectQL-aware components to auto-generate UI from object metadata.
   * Required for all DataSource implementations to support schema-aware components.
   * 
   * @param objectName - Object name
   * @returns Promise resolving to the object schema
   */
  getObjectSchema(objectName: string): Promise<any>;

  /**
   * List the platform's registered objects (lightweight `{ name, label }`
   * headers) for object-picker widgets — e.g. a sharing rule's `object-ref`
   * field. Backed by the metadata-registry list endpoint, so it includes both
   * code- and DB-defined objects. Optional: adapters that can't enumerate
   * objects may omit it, and callers should fall back gracefully (e.g. query
   * the metadata object) when it is absent.
   */
  getObjects?(): Promise<Array<{ name: string; label?: string }>>;

  /**
   * Get a view definition for an object.
   * Used by view components to render server-defined UI configurations.
   * Optional — implementations may return null to fall back to static config.
   * 
   * @param objectName - Object name
   * @param viewId - View identifier (e.g., 'all', 'active', 'my_records')
   * @returns Promise resolving to the view definition or null
   */
  getView?(objectName: string, viewId: string): Promise<any | null>;

  /**
   * Batch-fetch all persisted view overrides for an object in one call.
   *
   * Optional companion to {@link getView} that returns a `{viewName: override}`
   * map instead of fetching each view individually. Adapters should
   * implement this when the underlying transport supports a list-by-type
   * query (e.g. `GET /api/v1/meta/<object>` returning all `<object>/<view>`
   * items). When not implemented, callers should fall back to per-view
   * {@link getView}.
   *
   * @param objectName - Object name (e.g. 'lead')
   * @returns Promise resolving to a map of view name → override config
   */
  listViewOverrides?(objectName: string): Promise<Record<string, any>>;

  /**
   * Persist a view configuration to the backend.
   * Called when a user saves view settings (columns, filters, sort, toggles, etc.)
   * from the inline ViewConfigPanel.
   * Optional — implementations that do not support view persistence may omit this.
   *
   * @param objectName - Object name
   * @param viewId - View identifier (e.g., 'all', 'pipeline')
   * @param config - The full view configuration to persist
   * @returns Promise resolving to the persisted config (or void)
   */
  updateViewConfig?(objectName: string, viewId: string, config: Record<string, any>): Promise<Record<string, any> | void>;

  /**
   * List user-created overlay views for an object (ADR-0005 metadata
   * customization overlay). Returns view specs (not physical sys_view
   * records). Implementations route to
   * `GET /api/v1/meta/view` and filter client-side by `data.object`.
   */
  listViews?(objectName: string): Promise<any[]>;

  /**
   * Create a new overlay view. The view's `name` field is the stable
   * identifier; if omitted, a unique snake_case name is generated.
   * Routes to `PUT /api/v1/meta/view/:name`.
   */
  createView?(objectName: string, spec: Record<string, any>): Promise<Record<string, any> | void>;

  /**
   * Apply a partial update to an overlay view (read-merge-write because
   * overlay rows store the full view document). Routes to
   * `PUT /api/v1/meta/view/:name`.
   */
  updateView?(objectName: string, viewName: string, partial: Record<string, any>): Promise<Record<string, any> | void>;

  /**
   * Delete an overlay view. Routes to `DELETE /api/v1/meta/view/:name`,
   * which resets to the artifact default if one exists or removes the
   * overlay entirely if it was a user-created view.
   */
  deleteView?(objectName: string, viewName: string): Promise<{ deleted: boolean }>;


  /**
   * Get an application definition by name or ID.
   * Used by app shells to render server-defined navigation, branding, and layout.
   * Optional — implementations may return null to fall back to static config.
   * 
   * @param appId - Application identifier
   * @returns Promise resolving to the app definition or null
   */
  getApp?(appId: string): Promise<any | null>;

  /**
   * Get a page definition by name or ID.
   * Used by page renderers to fetch server-defined page layouts.
   * Optional — implementations may return null to fall back to static config.
   *
   * @param pageId - Page identifier (e.g., 'home', 'settings', 'onboarding')
   * @returns Promise resolving to the page definition or null
   */
  getPage?(pageId: string): Promise<any | null>;

  /**
   * Upload a single file to a resource.
   * Optional — only supported by data sources with file storage integration.
   *
   * @param resource - Resource name
   * @param file - File or Blob to upload
   * @param options - Upload options (recordId, fieldName, metadata)
   * @returns Promise resolving to the upload result
   */
  uploadFile?(
    resource: string,
    file: File | Blob,
    options?: {
      recordId?: string;
      fieldName?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (percent: number) => void;
    },
  ): Promise<FileUploadResult>;

  /**
   * Upload multiple files to a resource.
   * Optional — only supported by data sources with file storage integration.
   *
   * @param resource - Resource name
   * @param files - Array of Files or Blobs to upload
   * @param options - Upload options
   * @returns Promise resolving to array of upload results
   */
  uploadFiles?(
    resource: string,
    files: (File | Blob)[],
    options?: {
      recordId?: string;
      fieldName?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (percent: number) => void;
    },
  ): Promise<FileUploadResult[]>;

  /**
   * Perform server-side aggregation on a resource.
   * Used by chart widgets to offload grouping/aggregation to the backend,
   * avoiding large data downloads.
   * Optional — when not implemented, chart components will fall back to
   * fetching all records via `find()` and aggregating client-side.
   *
   * @param resource - Resource name (e.g., 'opportunity')
   * @param params - Aggregation parameters (field, function, groupBy, filter)
   * @returns Promise resolving to aggregated results
   */
  aggregate?(resource: string, params: AggregateParams): Promise<AggregateResult[]>;

  /**
   * Subscribe to mutation events.
   * When implemented, data-bound views (ListView, ObjectView) can auto-refresh
   * after any create/update/delete operation on relevant resources.
   *
   * @param callback - Invoked after each successful mutation
   * @returns Unsubscribe function to remove the listener
   *
   * @example
   * ```typescript
   * const unsub = dataSource.onMutation?.((event) => {
   *   if (event.resource === 'contacts') {
   *     refreshList();
   *   }
   * });
   * // later…
   * unsub?.();
   * ```
   */
  onMutation?(callback: (event: MutationEvent<T>) => void): () => void;

  /**
   * Initiate an asynchronous export job for a resource (server-driven streaming export).
   *
   * When implemented, callers can fire-and-forget large exports — the data
   * source is responsible for queueing the job, streaming records to the chosen
   * format, and producing a downloadable file. UI consumers then poll
   * `getExportJobProgress` until the job reaches a terminal state and use
   * `downloadUrl` (or `getExportJobDownloadUrl`) to deliver the file.
   *
   * Optional — when not implemented, callers fall back to client-side export
   * (the legacy synchronous blob path used by ObjectGrid).
   *
   * Aligns with the spec v4 `CreateExportJobRequest` / `CreateExportJobResponse`
   * contracts (see `@objectstack/spec/export`).
   *
   * @param resource - Resource name (e.g., 'account', 'opportunity')
   * @param request - Export request (format, fields, filter, sort, limit, …)
   * @returns Promise resolving to job tracking info ({ jobId, status, … })
   */
  createExportJob?(
    resource: string,
    request: CreateExportJobRequest,
  ): Promise<CreateExportJobResult>;

  /**
   * Poll the progress of a previously-created export job.
   *
   * Optional — required only if `createExportJob` is implemented.
   *
   * @param jobId - The job identifier returned by `createExportJob`.
   * @returns Promise resolving to current progress / terminal status.
   */
  getExportJobProgress?(jobId: string): Promise<ExportJobProgressInfo>;

  /**
   * Cancel an in-flight export job.
   * Optional — implementations that don't support cancellation may omit this
   * method (the UI will hide the Cancel button).
   *
   * @param jobId - The job identifier to cancel.
   */
  cancelExportJob?(jobId: string): Promise<void>;

  /**
   * Resolve the final download URL for a completed export job.
   *
   * Optional — when omitted, consumers fall back to the `downloadUrl` field on
   * the latest progress payload. Implementations may use this hook to mint
   * a fresh signed URL just before download.
   *
   * @param jobId - The job identifier.
   * @returns Promise resolving to a downloadable URL (may be short-lived).
   */
  getExportJobDownloadUrl?(jobId: string): Promise<string>;

  /**
   * Synchronously download a server-streamed export of a resource.
   *
   * Unlike the async `createExportJob` family, this resolves directly to the
   * exported file as a `Blob`: the server streams matching rows in the chosen
   * format (`csv` / `json` / `xlsx`), applies type-aware value formatting
   * (lookup → name, select → label, boolean → 是/否, dates formatted) and
   * enforces object / field / row permissions. Suited to interactive
   * "click Export → file downloads" flows up to the server's row cap (tens of
   * thousands of rows), with no client-side buffering of the full dataset
   * during generation.
   *
   * Optional — when not implemented, callers fall back to the client-side
   * export path (csv / json only, raw values, no type-aware formatting).
   *
   * @param resource - Resource name (e.g., 'account', 'opportunity')
   * @param request - Export request (format, fields, filter, sort, limit, …)
   * @returns Promise resolving to the exported file as a Blob.
   */
  exportDownload?(
    resource: string,
    request: ExportDownloadRequest,
  ): Promise<Blob>;

  /**
   * Bulk-import rows into an object in a single server call.
   *
   * Callers send **raw** spreadsheet values (CSV text or JSON row objects) plus
   * an optional `mapping` from source column → target field. The server coerces
   * every cell to its storage value from the object's field metadata (booleans,
   * numbers, dates→ISO, select label→code, lookup name→id), so the client does
   * NOT pre-convert special values. `writeMode` selects insert / update /
   * upsert (the latter two require `matchFields`); `dryRun` validates + previews
   * without persisting. The result carries per-row outcomes for an import
   * report + failed-row re-export.
   *
   * Optional — adapters without a server-side `/import` primitive may omit this
   * (the wizard falls back to a per-row `create` loop).
   *
   * @param resource - Object/table name
   * @param request - Import payload + options (see {@link ImportRequestOptions})
   * @returns Promise resolving to the aggregate + per-row import result
   */
  importRecords?(
    resource: string,
    request: ImportRequestOptions,
  ): Promise<ImportRecordsResult>;

  /**
   * Initiate an **asynchronous** import job — the large-file counterpart to
   * {@link importRecords}. The whole payload is posted once; the server persists
   * a job, returns immediately with a `jobId`, and processes rows in the
   * background (up to its row ceiling, typically 50,000). Callers poll
   * {@link getImportJobProgress} for live counters and
   * {@link getImportJobResults} for the capped per-row report.
   *
   * Optional — adapters whose backend lacks async import jobs omit this (the
   * wizard then keeps every file on the synchronous {@link importRecords} path).
   * Feature-detect with `typeof dataSource.createImportJob === 'function'`.
   *
   * @param resource - Object/table name
   * @param request - Same payload shape as {@link importRecords}
   * @returns Promise resolving to job tracking info ({ jobId, status, total, … })
   */
  createImportJob?(
    resource: string,
    request: ImportRequestOptions,
  ): Promise<CreateImportJobResult>;

  /**
   * Poll the progress of a previously-created import job.
   * Optional — required only if {@link createImportJob} is implemented.
   *
   * @param jobId - The job identifier returned by {@link createImportJob}.
   * @returns Promise resolving to current counters / terminal status.
   */
  getImportJobProgress?(jobId: string): Promise<ImportJobProgressInfo>;

  /**
   * Fetch the per-row results of an import job (server-capped; failures first).
   * Optional — required only if {@link createImportJob} is implemented.
   *
   * @param jobId - The job identifier.
   * @returns Progress fields plus `results` and a `resultsTruncated` flag.
   */
  getImportJobResults?(jobId: string): Promise<ImportJobResultsInfo>;

  /**
   * List recent import jobs (history), newest first.
   * Optional — implementations without a history endpoint omit this.
   *
   * @param options - Optional filters (object, status) + pagination.
   */
  listImportJobs?(options?: ListImportJobsOptions): Promise<ImportJobSummaryInfo[]>;

  /**
   * Cancel a pending/running import job (cooperative — the worker stops at its
   * next progress boundary). Optional; the UI hides Cancel when omitted.
   *
   * @param jobId - The job identifier to cancel.
   */
  cancelImportJob?(jobId: string): Promise<void>;

  /**
   * Logically roll back a finished import job: delete the records it created
   * and restore the records it updated to their pre-import field values.
   * Optional — only jobs the server captured an undo log for are undoable
   * (see {@link ImportJobProgressInfo.undoable}). The UI hides Undo when this
   * is omitted or the job reports `undoable: false`.
   *
   * @param jobId - The job identifier to undo.
   * @returns Counts of deleted / restored / failed reversal operations.
   */
  undoImportJob?(jobId: string): Promise<ImportJobUndoResult>;
}

/**
 * How each incoming import row is committed against existing data. Mirrors the
 * server's `ImportWriteMode` (`@objectstack/spec`).
 * - `insert` — always create a new record (default; ignores `matchFields`)
 * - `update` — update the record matched by `matchFields`; skip when none match
 * - `upsert` — update when matched, else create
 */
export type ImportWriteMode = 'insert' | 'update' | 'upsert';

/**
 * A single source-column → target-field mapping with optional per-column
 * transform metadata. Mirrors the server's `FieldMappingEntry`.
 */
export interface ImportFieldMappingEntry {
  sourceField: string;
  targetField: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'trim' | 'date_format' | 'lookup';
  defaultValue?: unknown;
  required?: boolean;
}

/**
 * Options + payload for {@link DataSource.importRecords}. Mirrors the server's
 * `ImportRequest` (`POST /api/v1/data/:object/import`).
 */
export interface ImportRequestOptions {
  /** Payload shape — inferred from `csv`/`rows` when omitted. */
  format?: 'csv' | 'json';
  /** CSV text (when `format = 'csv'`). */
  csv?: string;
  /** Row objects (when `format = 'json'`). */
  rows?: Array<Record<string, unknown>>;
  /** Source column → target field mapping (compact record or entry array). */
  mapping?: Record<string, string> | ImportFieldMappingEntry[];
  /**
   * Name of a registered `mapping` metadata artifact (framework #2611). When
   * set, the server resolves the mapping by name and applies its
   * fieldMapping pipeline (rename + transforms, strict projection); mutually
   * exclusive with the inline `mapping` rename above.
   */
  mappingName?: string;
  /** Validate + coerce every row without persisting. @default false */
  dryRun?: boolean;
  /** insert / update / upsert semantics. @default 'insert' */
  writeMode?: ImportWriteMode;
  /** Fields that identify an existing record (required for update/upsert). */
  matchFields?: string[];
  /** Fire triggers/hooks for each imported row (off by default for bulk). */
  runAutomations?: boolean;
  /** Trim leading/trailing whitespace from string cells. @default true */
  trimWhitespace?: boolean;
  /** Strings treated as null/blank besides the empty string. */
  nullValues?: string[];
  /** Keep unmatched select values instead of failing the row. @default false */
  createMissingOptions?: boolean;
  /** Skip rows whose `matchFields` are blank. @default false */
  skipBlankMatchKey?: boolean;
}

/**
 * Outcome of one imported row. Mirrors the server's `ImportRowResult`.
 */
export interface ImportRowResult {
  /** 1-based row number in the source data. */
  row: number;
  /** Whether the row succeeded. */
  ok: boolean;
  /** What happened to the row. */
  action?: 'created' | 'updated' | 'skipped' | 'failed';
  /** Record id (created/updated rows). */
  id?: string;
  /** Field that caused a coercion/validation error (failed rows). */
  field?: string;
  /** Error code (failed rows). */
  code?: string;
  /** Human-readable error message (failed rows). */
  error?: string;
}

/**
 * Aggregate summary + per-row results from {@link DataSource.importRecords}.
 * Mirrors the server's `ImportResponse`.
 */
export interface ImportRecordsResult {
  object: string;
  dryRun: boolean;
  writeMode: ImportWriteMode;
  total: number;
  ok: number;
  errors: number;
  created: number;
  updated: number;
  skipped: number;
  results: ImportRowResult[];
}

/**
 * Lifecycle status of an asynchronous import job. Mirrors the server's
 * `ImportJobStatus` enum (`@objectstack/spec`).
 */
export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/**
 * Result of {@link DataSource.createImportJob}. `jobId` is the polling key.
 * Mirrors the server's `CreateImportJobResponse`.
 */
export interface CreateImportJobResult {
  /** Server-assigned job identifier. */
  jobId: string;
  /** Object the job imports into. */
  object: string;
  /** Initial status (usually 'pending'). */
  status: ImportJobStatus;
  /** Total rows accepted for processing. */
  total: number;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
}

/**
 * Live progress of an import job, returned by
 * {@link DataSource.getImportJobProgress}. Mirrors the server's
 * `ImportJobProgress`.
 */
export interface ImportJobProgressInfo {
  jobId: string;
  object: string;
  status: ImportJobStatus;
  dryRun?: boolean;
  writeMode?: ImportWriteMode;
  /** Total rows in the job. */
  total: number;
  /** Rows processed so far. */
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  /** 0–100 completion. */
  percentComplete: number;
  /** Whether this job can still be logically rolled back (see {@link DataSource.undoImportJob}). */
  undoable?: boolean;
  /** ISO-8601 timestamp of when the job was undone / rolled back. */
  revertedAt?: string;
  /** Failure detail when `status === 'failed'`. */
  error?: string;
  /** ISO-8601 start timestamp. */
  startedAt?: string;
  /** ISO-8601 completion timestamp. */
  completedAt?: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
}

/**
 * Import-job progress plus the capped per-row report, returned by
 * {@link DataSource.getImportJobResults}. Mirrors the server's
 * `ImportJobResults`.
 */
export interface ImportJobResultsInfo extends ImportJobProgressInfo {
  /** Per-row outcomes (server-capped; failures first). */
  results: ImportRowResult[];
  /** True when `results` omits rows because the cap was exceeded. */
  resultsTruncated: boolean;
}

/**
 * One row in the import-job history list, returned by
 * {@link DataSource.listImportJobs}. Mirrors the server's `ImportJobSummary`.
 */
export interface ImportJobSummaryInfo {
  jobId: string;
  object: string;
  status: ImportJobStatus;
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  createdAt?: string;
  completedAt?: string;
  /** Whether this job can still be logically rolled back. */
  undoable?: boolean;
  /** ISO-8601 timestamp of when the job was undone / rolled back. */
  revertedAt?: string;
}

/**
 * Outcome of {@link DataSource.undoImportJob} — a logical rollback. Mirrors the
 * server's `UndoImportJobResponse`.
 */
export interface ImportJobUndoResult {
  /** Whether the undo completed. */
  success: boolean;
  jobId: string;
  object: string;
  /** Created records deleted. */
  deleted: number;
  /** Updated records restored to their pre-import values. */
  restored: number;
  /** Reversal operations that failed. */
  failed: number;
}

/**
 * Filters + pagination for {@link DataSource.listImportJobs}.
 */
export interface ListImportJobsOptions {
  /** Only jobs importing into this object. */
  object?: string;
  /** Only jobs in this status. */
  status?: ImportJobStatus;
  /** Page size (server clamps; default 50). */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
}

/**
 * Request payload for `DataSource.exportDownload` (synchronous streamed export).
 *
 * Mirrors the active list view: pass the same `filter` / `sort` the list is
 * showing so the exported file matches what the user sees.
 */
export interface ExportDownloadRequest {
  /** Output file format. Defaults to 'csv'. */
  format?: 'csv' | 'json' | 'xlsx';
  /** Subset of fields to include (defaults to all readable columns). */
  fields?: string[];
  /** Server-side filter (engine-specific shape, often the active view filter). */
  filter?: unknown;
  /** Sort instructions; multiple keys allowed, order preserved. */
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  /** Hard cap on records exported (server enforces its own ceiling too). */
  limit?: number;
  /** Whether to write a header row (csv / xlsx). Default true. */
  includeHeaders?: boolean;
}

/**
 * Lifecycle status of a server-driven export job.
 * Mirrors the `ExportJobStatus` enum from `@objectstack/spec/export`.
 */
export type ExportJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

/**
 * Output formats supported by async export jobs.
 */
export type ExportJobFormat = 'json' | 'jsonl' | 'csv' | 'xlsx' | 'parquet';

/**
 * Request payload for `DataSource.createExportJob`.
 *
 * Mirrors the spec v4 `CreateExportJobRequest` shape; ObjectUI does not import
 * the zod schema directly to keep `@object-ui/types` zero-dependency.
 */
export interface CreateExportJobRequest {
  /** Output file format. Defaults to 'csv'. */
  format?: ExportJobFormat;
  /** Subset of fields to include (defaults to all visible columns). */
  fields?: string[];
  /** Server-side filter (engine-specific shape, often the view filter). */
  filter?: Record<string, unknown>;
  /** Sort instructions; multiple keys allowed. */
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  /** Hard cap on records exported (server may enforce its own ceiling). */
  limit?: number;
  /** Whether to write a header row (CSV/XLSX). Default true. */
  includeHeaders?: boolean;
  /** Text encoding for textual formats. Default 'utf-8'. */
  encoding?: string;
  /** Optional named template (column ordering, formatting, locale). */
  templateId?: string;
}

/**
 * Result of `DataSource.createExportJob`.
 *
 * UI consumers use `jobId` as the polling key.
 */
export interface CreateExportJobResult {
  /** Server-assigned job identifier. */
  jobId: string;
  /** Initial status. Usually 'pending' or 'processing'. */
  status: ExportJobStatus;
  /** Optional record-count estimate (used to render initial progress). */
  estimatedRecords?: number;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
}

/**
 * Progress payload returned by `DataSource.getExportJobProgress`.
 *
 * Once `status` is 'completed', `downloadUrl` (or
 * `DataSource.getExportJobDownloadUrl`) becomes available.
 */
export interface ExportJobProgressInfo {
  /** Job identifier. */
  jobId: string;
  /** Current lifecycle status. */
  status: ExportJobStatus;
  /** Format the file is being produced in. */
  format?: ExportJobFormat;
  /** Total records in the slice (may be unknown for streaming exports). */
  totalRecords?: number;
  /** Records written to the output stream so far. */
  processedRecords?: number;
  /** 0–100 progress; computed by the server when `totalRecords` is known. */
  percentComplete?: number;
  /** Final file size in bytes (present after completion). */
  fileSize?: number;
  /** Direct download URL (present after completion). */
  downloadUrl?: string;
  /** ISO-8601 timestamp at which `downloadUrl` expires. */
  downloadExpiresAt?: string;
  /** Error details when `status === 'failed'`. */
  error?: { code: string; message: string };
  /** ISO-8601 start timestamp. */
  startedAt?: string;
  /** ISO-8601 completion timestamp. */
  completedAt?: string;
}

/**
 * Describes a mutation that occurred on a DataSource.
 * Emitted by `DataSource.onMutation` subscribers after create/update/delete.
 */
export interface MutationEvent<T = any> {
  /** The type of mutation that occurred */
  type: 'create' | 'update' | 'delete';
  /** The resource (object) name that was mutated */
  resource: string;
  /** The affected record (present for create/update) */
  record?: T;
  /** The ID of the affected record (present for update/delete) */
  id?: string | number;
}

/**
 * Parameters for server-side aggregation.
 * Describes how to group and aggregate data on the backend.
 */
export interface AggregateParams {
  /** Field to aggregate (e.g., 'amount') */
  field: string;
  /** Aggregation function (e.g., 'sum', 'count', 'avg', 'min', 'max') */
  function: string;
  /** Field to group by (e.g., 'stage') */
  groupBy: string;
  /** Optional filter to apply before aggregation */
  filter?: any;
}

/**
 * Result of a server-side aggregation.
 * Each entry represents one group with the aggregated value.
 */
export interface AggregateResult {
  [key: string]: any;
}

/**
 * Data scope context for managing data state.
 * Provides reactive data management within the UI.
 */
export interface DataScope {
  /**
   * Data source instance
   */
  dataSource?: DataSource;

  /**
   * Current data
   */
  data?: any;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Error state
   */
  error?: Error | string | null;

  /**
   * Refresh data
   */
  refresh?: () => Promise<void>;

  /**
   * Set data
   */
  setData?: (data: any) => void;
}

/**
 * Data context for component trees.
 * Allows components to access and share data.
 */
export interface DataContext {
  /**
   * Named data scopes
   */
  scopes: Record<string, DataScope>;

  /**
   * Register a data scope
   */
  registerScope: (name: string, scope: DataScope) => void;

  /**
   * Get a data scope by name
   */
  getScope: (name: string) => DataScope | undefined;

  /**
   * Remove a data scope
   */
  removeScope: (name: string) => void;
}

/**
 * Data binding configuration.
 * Defines how a component's data is sourced and updated.
 */
export interface DataBinding {
  /**
   * Data source name
   */
  source?: string;

  /**
   * Resource name
   */
  resource?: string;

  /**
   * Query parameters
   */
  params?: QueryParams;

  /**
   * Transform function for data
   */
  transform?: (data: any) => any;

  /**
   * Auto-refresh interval (ms)
   */
  refreshInterval?: number;

  /**
   * Cache data
   */
  cache?: boolean;

  /**
   * Cache TTL (ms)
   */
  cacheTTL?: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  /**
   * Field name
   */
  field: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error code
   */
  code?: string;
}

/**
 * API error response
 */
export interface APIError {
  /**
   * Error message
   */
  message: string;

  /**
   * HTTP status code
   */
  status?: number;

  /**
   * Error code
   */
  code?: string;

  /**
   * Validation errors
   */
  errors?: ValidationError[];

  /**
   * Additional error data
   */
  data?: any;
}
