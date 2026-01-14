/**
 * @object-ui/data-objectql - ObjectQL Data Source Adapter
 * 
 * This package provides a data source adapter for integrating Object UI
 * with ObjectQL API backends. It implements the universal DataSource interface
 * from @object-ui/types to provide seamless data access.
 * 
 * This adapter uses the official @objectql/sdk package for all API communication.
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

import { DataApiClient } from '@objectql/sdk';
import type { 
  DataApiClientConfig,
  DataApiListParams,
  FilterExpression
} from '@objectql/types';

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
  filters?: FilterExpression;
  
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
 * Compatible with @objectql/sdk DataApiClientConfig
 */
export interface ObjectQLConfig extends DataApiClientConfig {
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
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
  
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * ObjectQL Data Source Adapter
 * 
 * Implements the universal DataSource interface to connect Object UI
 * components with ObjectQL API backends using the official @objectql/sdk.
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
  private client: DataApiClient;
  
  constructor(config: ObjectQLConfig) {
    // Initialize the official ObjectQL SDK client
    this.client = new DataApiClient(config);
  }
  
  /**
   * Convert universal QueryParams to ObjectQL DataApiListParams format
   */
  private convertParams(params?: QueryParams): DataApiListParams {
    if (!params) return {};
    
    const objectqlParams: DataApiListParams = {};
    
    // Convert $select to fields
    if (params.$select) {
      objectqlParams.fields = params.$select;
    }
    
    // Convert $filter to filters (FilterExpression format)
    if (params.$filter) {
      // If it's already an array (FilterExpression), use it directly
      if (Array.isArray(params.$filter)) {
        objectqlParams.filter = params.$filter as FilterExpression;
      } else {
        // Convert object format to FilterExpression format
        objectqlParams.filter = Object.entries(params.$filter).map(
          ([key, value]) => [key, '=', value] as [string, string, any]
        ) as FilterExpression;
      }
    }
    
    // Convert $orderby to sort
    if (params.$orderby) {
      objectqlParams.sort = Object.entries(params.$orderby).map(
        ([key, dir]) => [key, dir] as [string, 'asc' | 'desc']
      );
    }
    
    // Convert pagination
    if (params.$skip !== undefined) {
      objectqlParams.skip = params.$skip;
    }
    
    if (params.$top !== undefined) {
      objectqlParams.limit = params.$top;
    }
    
    return objectqlParams;
  }
  
  /**
   * Fetch multiple records from ObjectQL
   * 
   * @param resource - Object name (e.g., 'contacts', 'accounts')
   * @param params - Query parameters
   * @returns Promise resolving to query result with data and metadata
   */
  async find(resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    const objectqlParams = this.convertParams(params);
    
    try {
      const response = await this.client.list<T>(resource, objectqlParams);
      
      const data = response.items || [];
      const total = response.meta?.total;
      
      return {
        data,
        total,
        page: response.meta?.page,
        pageSize: objectqlParams.limit,
        hasMore: response.meta?.has_next,
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
      const response = await this.client.get<T>(resource, id);
      
      // Return the item data, filtering fields if requested
      if (params?.$select && response) {
        const filtered: any = {};
        for (const field of params.$select) {
          if (field in response) {
            filtered[field] = (response as any)[field];
          }
        }
        return filtered as T;
      }
      
      return response as T || null;
    } catch (err: any) {
      // Return null for not found errors
      if (err.code === 'NOT_FOUND' || err.status === 404) {
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
      const response = await this.client.create<T>(resource, data);
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
      const response = await this.client.update<T>(resource, id, data);
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
      const response = await this.client.delete(resource, id);
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
   * Execute a bulk operation
   * 
   * @param resource - Object name
   * @param operation - Operation type
   * @param data - Bulk data or filters for update/delete
   * @returns Promise resolving to operation results
   */
  async bulk(
    resource: string, 
    operation: 'create' | 'update' | 'delete', 
    data: Partial<T>[] | any
  ): Promise<T[]> {
    try {
      if (operation === 'create') {
        const response = await this.client.createMany<T>(resource, data);
        return response.items || [];
      } else if (operation === 'update') {
        // For bulk updates with SDK, we need filters and update data
        // This is a limitation - the old API accepted array of records
        // The new SDK requires filters + data
        if (Array.isArray(data)) {
          // If array of records is provided, we need to update them individually
          // This is less efficient but maintains compatibility
          const results: T[] = [];
          for (const item of data) {
            if ('_id' in item && item._id) {
              const updated = await this.client.update<T>(resource, item._id, item);
              results.push(updated as T);
            }
          }
          return results;
        } else {
          throw new Error('Bulk update requires array of records with _id field');
        }
      } else if (operation === 'delete') {
        // For bulk deletes with SDK, similar approach
        if (Array.isArray(data)) {
          // Delete each record individually
          const results: T[] = [];
          for (const item of data) {
            if ('_id' in item && item._id) {
              await this.client.delete(resource, item._id);
              results.push(item as T);
            }
          }
          return results;
        } else {
          throw new Error('Bulk delete requires array of records with _id field');
        }
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
