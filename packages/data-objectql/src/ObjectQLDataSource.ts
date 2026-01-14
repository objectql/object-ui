/**
 * @object-ui/data-objectql - ObjectQL Data Source Adapter
 * 
 * This package provides a data source adapter for integrating Object UI
 * with ObjectQL API backends. It implements the universal DataSource interface
 * from @object-ui/types to provide seamless data access.
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
   */
  filters?: Record<string, any>;
  
  /**
   * Sort configuration
   * @example { created: -1, name: 1 }
   */
  sort?: Record<string, 1 | -1>;
  
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
 */
export interface ObjectQLConfig {
  /**
   * Base URL of the ObjectQL server
   * @example 'https://api.example.com' or '/api'
   */
  baseUrl: string;
  
  /**
   * API version (optional)
   * @default 'v1'
   */
  version?: string;
  
  /**
   * Authentication token (optional)
   * Will be sent as Authorization header
   */
  token?: string;
  
  /**
   * Space ID for multi-tenant environments (optional)
   */
  spaceId?: string;
  
  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
  
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Whether to include credentials in requests
   * @default true
   */
  withCredentials?: boolean;
}

/**
 * ObjectQL Data Source Adapter
 * 
 * Implements the universal DataSource interface to connect Object UI
 * components with ObjectQL API backends.
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
 *   filters: { status: 'active' },
 *   sort: { created: -1 },
 *   limit: 10
 * });
 * ```
 */
export class ObjectQLDataSource<T = any> implements DataSource<T> {
  private config: Required<ObjectQLConfig>;
  
  constructor(config: ObjectQLConfig) {
    this.config = {
      version: 'v1',
      timeout: 30000,
      withCredentials: true,
      headers: {},
      ...config,
      token: config.token || '',
      spaceId: config.spaceId || '',
    };
  }
  
  /**
   * Build the full API URL for a resource
   */
  private buildUrl(resource: string, id?: string | number): string {
    const { baseUrl, version } = this.config;
    const parts = [baseUrl, 'api', version, 'objects', resource];
    if (id !== undefined) {
      parts.push(String(id));
    }
    return parts.join('/');
  }
  
  /**
   * Build request headers
   */
  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    
    if (this.config.spaceId) {
      headers['X-Space-Id'] = this.config.spaceId;
    }
    
    return headers;
  }
  
  /**
   * Convert universal QueryParams to ObjectQL format
   */
  private convertParams(params?: QueryParams): ObjectQLQueryParams {
    if (!params) return {};
    
    const objectqlParams: ObjectQLQueryParams = {};
    
    // Convert $select to fields
    if (params.$select) {
      objectqlParams.fields = params.$select;
    }
    
    // Convert $filter to filters
    if (params.$filter) {
      objectqlParams.filters = params.$filter;
    }
    
    // Convert $orderby to sort
    if (params.$orderby) {
      objectqlParams.sort = Object.entries(params.$orderby).reduce(
        (acc, [key, dir]) => ({
          ...acc,
          [key]: dir === 'asc' ? 1 : -1,
        }),
        {}
      );
    }
    
    // Convert pagination
    if (params.$skip !== undefined) {
      objectqlParams.skip = params.$skip;
    }
    
    if (params.$top !== undefined) {
      objectqlParams.limit = params.$top;
    }
    
    if (params.$count !== undefined) {
      objectqlParams.count = params.$count;
    }
    
    return objectqlParams;
  }
  
  /**
   * Make an HTTP request to ObjectQL API
   */
  private async request<R = any>(
    url: string, 
    options: RequestInit = {}
  ): Promise<R> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(), 
      this.config.timeout
    );
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: this.buildHeaders(),
        credentials: this.config.withCredentials ? 'include' : 'omit',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error: APIError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
        
        try {
          const errorData = await response.json();
          error.message = errorData.message || error.message;
          error.code = errorData.code;
          error.errors = errorData.errors;
          error.data = errorData;
        } catch {
          // If error response is not JSON, use default message
        }
        
        throw error;
      }
      
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error && err.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          code: 'TIMEOUT',
        } as APIError;
      }
      
      throw err;
    }
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
    
    // Build query string
    const queryParams = new URLSearchParams();
    
    if (objectqlParams.fields?.length) {
      queryParams.append('fields', JSON.stringify(objectqlParams.fields));
    }
    
    if (objectqlParams.filters) {
      queryParams.append('filters', JSON.stringify(objectqlParams.filters));
    }
    
    if (objectqlParams.sort) {
      queryParams.append('sort', JSON.stringify(objectqlParams.sort));
    }
    
    if (objectqlParams.skip !== undefined) {
      queryParams.append('skip', String(objectqlParams.skip));
    }
    
    if (objectqlParams.limit !== undefined) {
      queryParams.append('top', String(objectqlParams.limit));
    }
    
    if (objectqlParams.count) {
      queryParams.append('$count', 'true');
    }
    
    const url = `${this.buildUrl(resource)}?${queryParams.toString()}`;
    const response = await this.request<{
      value: T[];
      '@odata.count'?: number;
    }>(url);
    
    const data = response.value || [];
    const total = response['@odata.count'];
    
    return {
      data,
      total,
      page: objectqlParams.skip && objectqlParams.limit 
        ? Math.floor(objectqlParams.skip / objectqlParams.limit) + 1 
        : 1,
      pageSize: objectqlParams.limit,
      hasMore: total !== undefined && data.length > 0 
        ? (objectqlParams.skip || 0) + data.length < total
        : undefined,
    };
  }
  
  /**
   * Fetch a single record by ID
   * 
   * @param resource - Object name
   * @param id - Record identifier
   * @param params - Additional query parameters
   * @returns Promise resolving to the record or null if not found
   */
  async findOne(
    resource: string, 
    id: string | number, 
    params?: QueryParams
  ): Promise<T | null> {
    const objectqlParams = this.convertParams(params);
    
    const queryParams = new URLSearchParams();
    
    if (objectqlParams.fields?.length) {
      queryParams.append('fields', JSON.stringify(objectqlParams.fields));
    }
    
    const url = `${this.buildUrl(resource, id)}?${queryParams.toString()}`;
    
    try {
      return await this.request<T>(url);
    } catch (err) {
      if ((err as APIError).status === 404) {
        return null;
      }
      throw err;
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
    const url = this.buildUrl(resource);
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    const url = this.buildUrl(resource, id);
    return this.request<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * Delete a record
   * 
   * @param resource - Object name
   * @param id - Record identifier
   * @returns Promise resolving to true if successful
   */
  async delete(resource: string, id: string | number): Promise<boolean> {
    const url = this.buildUrl(resource, id);
    await this.request(url, { method: 'DELETE' });
    return true;
  }
  
  /**
   * Execute a bulk operation
   * 
   * @param resource - Object name
   * @param operation - Operation type
   * @param data - Bulk data
   * @returns Promise resolving to operation results
   */
  async bulk(
    resource: string, 
    operation: 'create' | 'update' | 'delete', 
    data: Partial<T>[]
  ): Promise<T[]> {
    const url = `${this.buildUrl(resource)}/bulk`;
    return this.request<T[]>(url, {
      method: 'POST',
      body: JSON.stringify({ operation, data }),
    });
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
