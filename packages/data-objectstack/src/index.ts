/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ObjectStackClient, type QueryOptions as ObjectStackQueryOptions } from '@objectstack/client';
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';
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
 *   token: 'your-api-token'
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

  constructor(config: {
    baseUrl: string;
    token?: string;
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    cache?: {
      maxSize?: number;
      ttl?: number;
    };
  }) {
    this.client = new ObjectStackClient(config);
    this.metadataCache = new MetadataCache(config.cache);
  }

  /**
   * Ensure the client is connected to the server.
   * Call this before making requests or it will auto-connect on first request.
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      try {
        await this.client.connect();
        this.connected = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to ObjectStack server';
        throw new ConnectionError(
          errorMessage,
          undefined,
          { originalError: error }
        );
      }
    }
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

    const resultObj = result as { value?: T[]; count?: number };
    return {
      data: resultObj.value || [],
      total: resultObj.count || (resultObj.value ? resultObj.value.length : 0),
      // Calculate page number safely
      page: params?.$skip && params.$top ? Math.floor(params.$skip / params.$top) + 1 : 1,
      pageSize: params?.$top,
      hasMore: params?.$top ? (resultObj.value?.length || 0) === params.$top : false,
    };
  }

  /**
   * Find a single record by ID.
   */
  async findOne(resource: string, id: string | number, _params?: QueryParams): Promise<T | null> {
    await this.connect();

    try {
      const record = await this.client.data.get<T>(resource, String(id));
      return record;
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
    return this.client.data.create<T>(resource, data);
  }

  /**
   * Update an existing record.
   */
  async update(resource: string, id: string | number, data: Partial<T>): Promise<T> {
    await this.connect();
    return this.client.data.update<T>(resource, String(id), data);
  }

  /**
   * Delete a record.
   */
  async delete(resource: string, id: string | number): Promise<boolean> {
    await this.connect();
    const result = await this.client.data.delete(resource, String(id));
    return result.success;
  }

  /**
   * Bulk operations with optimized batch processing and error handling.
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

    try {
      switch (operation) {
        case 'create':
          return await this.client.data.createMany<T>(resource, data);
        
        case 'delete': {
          const ids = data.map(item => (item as Record<string, unknown>).id).filter(Boolean);
          
          if (ids.length === 0) {
            // Track which items are missing IDs
            const errors = data.map((_, index) => ({
              index,
              error: `Missing ID for item at index ${index}`
            }));
            
            throw new BulkOperationError('delete', 0, data.length, errors);
          }
          
          await this.client.data.deleteMany(resource, ids);
          return [] as T[];
        }
        
        case 'update': {
          // Check if client supports updateMany
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (this.client.data as any).updateMany === 'function') {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateMany = (this.client.data as any).updateMany;
              return await updateMany(resource, data) as T[];
            } catch {
              // If updateMany is not supported, fall back to individual updates
              // Silently fallback without logging
            }
          }
          
          // Fallback: Process updates individually with detailed error tracking
          const results: T[] = [];
          const errors: Array<{ index: number; error: unknown }> = [];
          
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const id = (item as Record<string, unknown>).id;
            
            if (!id) {
              errors.push({ index: i, error: 'Missing ID' });
              continue;
            }
            
            try {
              const result = await this.client.data.update<T>(resource, String(id), item);
              results.push(result);
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              errors.push({ index: i, error: errorMessage });
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
      options.filters = convertFiltersToAST(params.$filter);
    }

    // Sorting - convert to ObjectStack format
    if (params.$orderby) {
      const sortArray = Object.entries(params.$orderby).map(([field, order]) => {
        return order === 'desc' ? `-${field}` : field;
      });
      options.sort = sortArray;
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
        const result = await this.client.meta.getObject(objectName);
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
}

/**
 * Factory function to create an ObjectStack data source.
 * 
 * @example
 * ```typescript
 * const dataSource = createObjectStackAdapter({
 *   baseUrl: process.env.API_URL,
 *   token: process.env.API_TOKEN,
 *   cache: { maxSize: 100, ttl: 300000 }
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
