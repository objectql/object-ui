/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/data-objectql - ObjectQL Data Source Adapter
 * 
 * This package provides a data source adapter for integrating Object UI
 * with ObjectQL API backends. It implements the universal DataSource interface
 * from @object-ui/types to provide seamless data access.
 * 
 * This adapter uses the official @objectstack/client package for all API communication.
 * 
 * @module data-objectql
 * @packageDocumentation
 */

import type { 
  DataSource, 
  QueryParams, 
  QueryResult, 
  APIError 
} from '@object-ui/types';

import { ObjectStackClient } from '@objectstack/client';
import type { 
  ClientConfig,
  QueryOptions
} from '@objectstack/client';

import { convertFiltersToAST } from './utils/filter-converter';

/**
 * ObjectQL-specific query parameters.
 * Extends the standard QueryParams with ObjectQL-specific features.
 */
export interface ObjectQLQueryParams extends QueryParams {
  /**
   * ObjectQL fields configuration
   * Supports nested field selection and related object expansion
   * @example ['name', 'owner.name', 'related_list.name']
   */
  fields?: string[];
  
  /**
   * ObjectQL filters using MongoDB-like syntax
   * @example { name: 'John', age: { $gte: 18 } }
   * @example [['name', '=', 'John'], ['age', '>=', 18]]
   */
  filters?: Record<string, any>;
  
  /**
   * Sort configuration
   * @example [['created', 'desc'], ['name', 'asc']]
   */
  sort?: [string, 'asc' | 'desc'][];
  
  /**
   * Number of records to skip (pagination)
   */
  skip?: number;
  
  /**
   * Maximum number of records to return
   */
  limit?: number;
  
  /**
   * Whether to return total count
   */
  count?: boolean;
}

/**
 * ObjectQL connection configuration
 * Compatible with @objectstack/client ClientConfig
 */
export interface ObjectQLConfig extends ClientConfig {
  /**
   * Base URL of the ObjectQL server
   * @example 'https://api.example.com' or '/api'
   */
  baseUrl: string;
  
  /**
   * Authentication token (optional)
   * Will be sent as Authorization header
   */
  token?: string;
  
  /**
   * Custom fetch implementation (optional)
   */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

/**
 * ObjectQL Data Source Adapter
 * 
 * Implements the universal DataSource interface to connect Object UI
 * components with ObjectQL API backends using the official @objectstack/client.
 * 
 * @template T - The data type
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const dataSource = new ObjectQLDataSource({
 *   baseUrl: 'https://api.example.com',
 *   token: 'your-auth-token'
 * });
 * 
 * // Use with components
 * <SchemaRenderer 
 *   schema={schema} 
 *   dataSource={dataSource}
 * />
 * ```
 * 
 * @example
 * ```typescript
 * // Fetch data
 * const result = await dataSource.find('contacts', {
 *   fields: ['name', 'email', 'account.name'],
 *   filters: [['status', '=', 'active']],
 *   sort: [['created', 'desc']],
 *   limit: 10
 * });
 * ```
 */
export class ObjectQLDataSource<T = any> implements DataSource<T> {
  private client: ObjectStackClient;
  
  constructor(config: ObjectQLConfig) {
    // Initialize the official ObjectStack client
    this.client = new ObjectStackClient(config);
  }
  
  /**
   * Convert universal QueryParams to ObjectStack QueryOptions format
   */
  private convertParams(params?: QueryParams): QueryOptions {
    if (!params) return {};
    
    const queryOptions: QueryOptions = {};
    
    // Convert $select to select (field list)
    if (params.$select) {
      queryOptions.select = params.$select;
    }
    
    // Convert $filter to ObjectStack FilterNode AST format
    if (params.$filter) {
      queryOptions.filters = convertFiltersToAST(params.$filter);
    }
    
    // Convert $orderby to sort
    if (params.$orderby) {
      const sortEntries = Object.entries(params.$orderby);
      if (sortEntries.length > 0) {
        // Convert to array format expected by ObjectStack
        queryOptions.sort = sortEntries.map(([field, direction]) => 
          `${field}:${direction}`
        );
      }
    }
    
    // Convert pagination
    if (params.$skip !== undefined) {
      queryOptions.skip = params.$skip;
    }
    
    if (params.$top !== undefined) {
      queryOptions.top = params.$top;
    }
    
    return queryOptions;
  }  
  /**
   * Fetch multiple records from ObjectQL
   * 
   * @param resource - Object name (e.g., 'contacts', 'accounts')
   * @param params - Query parameters
   * @returns Promise resolving to query result with data and metadata
   */
  async find(resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    const queryOptions = this.convertParams(params);
    
    try {
      const response = await this.client.data.find<T>(resource, queryOptions);
      
      const data = response.value || [];
      const total = response.count;
      
      return {
        data,
        total,
        page: params?.$skip && params?.$top 
          ? Math.floor(params.$skip / params.$top) + 1 
          : undefined,
        pageSize: queryOptions.top,
        hasMore: total !== undefined && data.length < total,
      };
    } catch (err: any) {
      // Convert SDK errors to APIError format
      throw {
        message: err.message || 'Failed to fetch data',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Fetch a single record by ID
   * 
   * @param resource - Object name
   * @param id - Record identifier
   * @param params - Additional query parameters (fields selection)
   * @returns Promise resolving to the record or null if not found
   */
  async findOne(
    resource: string, 
    id: string | number, 
    params?: QueryParams
  ): Promise<T | null> {
    try {
      const response = await this.client.data.get<T>(resource, String(id));
      
      // Return the item data, filtering fields if requested
      if (params?.$select && response) {
        const filtered: any = {};
        for (const field of params.$select) {
          if (response && typeof response === 'object' && field in response) {
            filtered[field] = (response as any)[field];
          }
        }
        return filtered as T;
      }
      
      return response ? (response as T) : null;
    } catch (err: any) {
      // Return null for not found errors
      // ObjectStack client throws with different error format
      if (err.message?.includes('404') || err.status === 404) {
        return null;
      }
      
      // Re-throw other errors as APIError
      throw {
        message: err.message || 'Failed to fetch record',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Create a new record
   * 
   * @param resource - Object name
   * @param data - Record data
   * @returns Promise resolving to the created record
   */
  async create(resource: string, data: Partial<T>): Promise<T> {
    try {
      const response = await this.client.data.create<T>(resource, data);
      return response as T;
    } catch (err: any) {
      throw {
        message: err.message || 'Failed to create record',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Update an existing record
   * 
   * @param resource - Object name
   * @param id - Record identifier
   * @param data - Updated data (partial)
   * @returns Promise resolving to the updated record
   */
  async update(
    resource: string, 
    id: string | number, 
    data: Partial<T>
  ): Promise<T> {
    try {
      const response = await this.client.data.update<T>(resource, String(id), data);
      return response as T;
    } catch (err: any) {
      throw {
        message: err.message || 'Failed to update record',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Delete a record
   * 
   * @param resource - Object name
   * @param id - Record identifier
   * @returns Promise resolving to true if successful
   */
  async delete(resource: string, id: string | number): Promise<boolean> {
    try {
      const response = await this.client.data.delete(resource, String(id));
      return response.success ?? true;
    } catch (err: any) {
      throw {
        message: err.message || 'Failed to delete record',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Get object schema from ObjectQL
   * 
   * @param objectName - Object name
   * @returns Promise resolving to the object schema
   */
  async getObjectSchema(objectName: string): Promise<any> {
    try {
      // Use the Metadata API client to fetch object metadata
      const response = await this.client.meta.getObject(objectName);
      return response;
    } catch (err: any) {
      throw {
        message: err.message || 'Failed to fetch object schema',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
  
  /**
   * Execute a bulk operation
   * 
   * @param resource - Object name
   * @param operation - Operation type
   * @param data - Bulk data (array of records for create/update/delete)
   * @returns Promise resolving to operation results
   */
  async bulk(
    resource: string, 
    operation: 'create' | 'update' | 'delete', 
    data: Partial<T>[] | any
  ): Promise<T[]> {
    try {
      if (operation === 'create') {
        const response = await this.client.data.createMany<T>(resource, data);
        return response || [];
      } else if (operation === 'update') {
        // For update: extract IDs and update data
        if (!Array.isArray(data)) {
          throw new Error('Bulk update requires array of records');
        }
        
        const ids: string[] = [];
        let updateData: Partial<T> = {};
        
        for (const item of data) {
          const record: any = item as any;
          const id = record?.id ?? record?._id;
          if (id === undefined || id === null) {
            throw new Error(
              'Bulk update requires each item to include an `id` or `_id` field.'
            );
          }
          ids.push(String(id));
          // Use the first record's data for the update (excluding id fields)
          const { id: _omitId, _id: _omitUnderscore, ...rest } = record;
          updateData = rest;
        }
        
        await this.client.data.updateMany<T>(resource, ids, updateData);
        
        // Return updated records by fetching them
        const results: T[] = [];
        for (const id of ids) {
          const updated = await this.client.data.get<T>(resource, id);
          if (updated !== undefined && updated !== null) {
            results.push(updated as T);
          }
        }
        return results;
      } else if (operation === 'delete') {
        // For delete: extract IDs
        if (!Array.isArray(data)) {
          throw new Error('Bulk delete requires array of records or IDs');
        }
        
        const ids: string[] = [];
        for (const item of data) {
          const record: any = item as any;
          // Support both direct ID values and objects with id/_id field
          const id = typeof record === 'object' 
            ? (record?.id ?? record?._id) 
            : record;
          if (id === undefined || id === null) {
            throw new Error(
              'Bulk delete requires each item to include an `id` or `_id` field or be an id value.'
            );
          }
          ids.push(String(id));
        }
        
        await this.client.data.deleteMany(resource, ids);
        // For delete operations, we return an empty array by convention
        return [];
      }
      
      throw new Error(`Unknown bulk operation: ${operation}`);
    } catch (err: any) {
      throw {
        message: err.message || 'Failed to execute bulk operation',
        code: err.code,
        status: err.status,
        data: err,
      } as APIError;
    }
  }
}

/**
 * Create an ObjectQL data source instance
 * Helper function for easier instantiation
 * 
 * @param config - ObjectQL configuration
 * @returns ObjectQL data source instance
 * 
 * @example
 * ```typescript
 * const dataSource = createObjectQLDataSource({
 *   baseUrl: 'https://api.example.com',
 *   token: 'your-token'
 * });
 * ```
 */
export function createObjectQLDataSource<T = any>(
  config: ObjectQLConfig
): ObjectQLDataSource<T> {
  return new ObjectQLDataSource<T>(config);
}
