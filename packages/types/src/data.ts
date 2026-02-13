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
   * @returns Promise resolving to the updated record
   */
  update(resource: string, id: string | number, data: Partial<T>): Promise<T>;

  /**
   * Delete a record.
   * 
   * @param resource - Resource name
   * @param id - Record identifier
   * @returns Promise resolving to true if successful
   */
  delete(resource: string, id: string | number): Promise<boolean>;

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
