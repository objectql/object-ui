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
