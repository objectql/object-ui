/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ObjectStackClient, type QueryOptions as ObjectStackQueryOptions } from '@objectstack/client';
import type { DataSource, QueryParams, QueryResult, FileUploadResult } from '@object-ui/types';
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
    this.client = new ObjectStackClient(config);
    this.metadataCache = new MetadataCache(config.cache);
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 3;
    this.reconnectDelay = config.reconnectDelay ?? 1000;
    this.baseUrl = config.baseUrl;
    this.token = config.token;
  }

  /**
   * Ensure the client is connected to the server.
   * Call this before making requests or it will auto-connect on first request.
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      this.setConnectionState('connecting');
      
      try {
        await this.client.connect();
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
      }
    }
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
    await this.connect();

    const queryOptions = this.convertQueryParams(params);
    const result: unknown = await this.client.data.find<T>(resource, queryOptions);

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

    const resultObj = result as { records?: T[]; total?: number; value?: T[]; count?: number };
    const records = resultObj.records || resultObj.value || [];
    const total = resultObj.total ?? resultObj.count ?? records.length;
    return {
      data: records,
      total,
      // Calculate page number safely
      page: params?.$skip && params.$top ? Math.floor(params.$skip / params.$top) + 1 : 1,
      pageSize: params?.$top,
      hasMore: params?.$top ? records.length === params.$top : false,
    };
  }

  /**
   * Find a single record by ID.
   */
  async findOne(resource: string, id: string | number, _params?: QueryParams): Promise<T | null> {
    await this.connect();

    try {
      const result = await this.client.data.get<T>(resource, String(id));
      return result.record;
    } catch (error: unknown) {
      // If record not found, return null instead of throwing
      if ((error as Record<string, unknown>)?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new record.
   */
  async create(resource: string, data: Partial<T>): Promise<T> {
    await this.connect();
    const result = await this.client.data.create<T>(resource, data);
    return result.record;
  }

  /**
   * Update an existing record.
   */
  async update(resource: string, id: string | number, data: Partial<T>): Promise<T> {
    await this.connect();
    const result = await this.client.data.update<T>(resource, String(id), data);
    return result.record;
  }

  /**
   * Delete a record.
   */
  async delete(resource: string, id: string | number): Promise<boolean> {
    await this.connect();
    const result = await this.client.data.delete(resource, String(id));
    return result.deleted;
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
   * Convert ObjectUI QueryParams to ObjectStack QueryOptions.
   * Maps OData-style conventions to ObjectStack conventions.
   */
  private convertQueryParams(params?: QueryParams): ObjectStackQueryOptions {
    if (!params) return {};

    const options: ObjectStackQueryOptions = {};

    // Selection
    if (params.$select) {
      options.select = params.$select;
    }

    // Filtering - convert to ObjectStack FilterNode AST format
    if (params.$filter) {
      if (Array.isArray(params.$filter)) {
        // Assume active AST format if it's already an array
        options.filters = params.$filter;
      } else {
        options.filters = convertFiltersToAST(params.$filter);
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
      // Use cache with automatic fetching
      const schema = await this.metadataCache.get(objectName, async () => {
        const result: any = await this.client.meta.getItem('object', objectName);
        
        // Unwrap 'item' property if present (common API response wrapper)
        if (result && result.item) {
          return result.item;
        }

        return result;
      });
      
      return schema;
    } catch (error: unknown) {
      // Check if it's a 404 error
      const errorObj = error as Record<string, unknown>;
      if (errorObj?.status === 404 || errorObj?.statusCode === 404) {
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
        // Try meta.getItem for view metadata
        const result: any = await this.client.meta.getItem(objectName, `views/${viewId}`);
        if (result && result.item) return result.item;
        return result ?? null;
      });
    } catch {
      // Server doesn't support view metadata — return null to fall back to static config
      return null;
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
   * Perform server-side aggregation via the ObjectStack analytics API.
   * Uses `this.client.analytics.query()` from @objectstack/client to leverage
   * the SDK's built-in auth, headers, and fetch configuration.
   * Falls back to client-side aggregation via find() if the analytics endpoint
   * is not available.
   */
  async aggregate(resource: string, params: { field: string; function: string; groupBy: string; filter?: any }): Promise<any[]> {
    await this.connect();

    try {
      const payload: Record<string, unknown> = {
        object: resource,
        measures: [{ field: params.field, function: params.function }],
        dimensions: [params.groupBy],
      };
      if (params.filter) {
        payload.filters = params.filter;
      }

      const data = await this.client.analytics.query(payload);
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      if (data?.results && Array.isArray(data.results)) return data.results;
      return [];
    } catch {
      // If the analytics endpoint is not available, fall back to
      // find() + client-side aggregation
      const result = await this.find(resource as any);
      const records = result.data || [];
      if (records.length === 0) return [];

      return this.aggregateClientSide(records, params);
    }
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
export type { PluginContract, PluginExport, PluginAPIContract, ContractValidationResult, ContractValidationError } from './contracts';

export { IntegrationManager } from './integration';
export type { IntegrationConfig, IntegrationTrigger, IntegrationProvider, SlackIntegrationConfig, EmailIntegrationConfig, WebhookIntegrationConfig } from './integration';

export { SecurityManager } from './security';
export type { SecurityPolicy, CSPConfig, AuditLogConfig, AuditEventType, DataMaskingConfig, DataMaskingRule, AuditLogEntry } from './security';

export { createDefaultCanvasConfig, snapToGrid, calculateAutoLayout } from './studio';
export type { StudioCanvasConfig, StudioPropertyEditor, StudioThemeBuilderConfig, StudioColorPalette, StudioTypographyPreset, StudioShadowPreset } from './studio';
