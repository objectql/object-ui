/**
 * React hooks for ObjectQL integration
 * 
 * @module hooks
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QueryParams, QueryResult } from '@object-ui/types';
import { ObjectQLDataSource, type ObjectQLConfig } from './ObjectQLDataSource';

/**
 * Options for useObjectQL hook
 */
export interface UseObjectQLOptions {
  /**
   * ObjectQL configuration
   */
  config: ObjectQLConfig;
}

/**
 * Options for useObjectQLQuery hook
 */
export interface UseObjectQLQueryOptions extends QueryParams {
  /**
   * Whether to fetch data automatically on mount
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Refetch interval in milliseconds
   */
  refetchInterval?: number;
  
  /**
   * Callback when data is successfully fetched
   */
  onSuccess?: (data: any) => void;
  
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Options for useObjectQLMutation hook
 */
export interface UseObjectQLMutationOptions {
  /**
   * Callback when mutation succeeds
   */
  onSuccess?: (data: any) => void;
  
  /**
   * Callback when mutation fails
   */
  onError?: (error: Error) => void;
}

/**
 * Hook to create and manage an ObjectQL data source instance
 * 
 * @param options - Configuration options
 * @returns ObjectQL data source instance
 * 
 * @example
 * ```typescript
 * const dataSource = useObjectQL({
 *   config: {
 *     baseUrl: 'https://api.example.com',
 *     token: authToken
 *   }
 * });
 * ```
 */
export function useObjectQL(options: UseObjectQLOptions): ObjectQLDataSource {
  return useMemo(
    () => new ObjectQLDataSource(options.config),
    // Serialize the entire config to detect any changes
    [JSON.stringify(options.config)]
  );
}

/**
 * Hook to fetch data from ObjectQL
 * 
 * @param dataSource - ObjectQL data source instance
 * @param resource - Resource name
 * @param options - Query options
 * @returns Query state and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useObjectQLQuery(
 *   dataSource,
 *   'contacts',
 *   {
 *     $filter: { status: 'active' },
 *     $orderby: { created: 'desc' },
 *     $top: 10
 *   }
 * );
 * ```
 */
export function useObjectQLQuery<T = any>(
  dataSource: ObjectQLDataSource,
  resource: string,
  options: UseObjectQLQueryOptions = {}
): {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  result: QueryResult<T> | null;
} {
  const [data, setData] = useState<T[] | null>(null);
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const {
    enabled = true,
    refetchInterval,
    onSuccess,
    onError,
    ...queryParams
  } = options;
  
  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const queryResult = await dataSource.find(resource, queryParams);
      setResult(queryResult);
      setData(queryResult.data);
      onSuccess?.(queryResult.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [dataSource, resource, enabled, onSuccess, onError, JSON.stringify(queryParams)]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (!refetchInterval) return;
    
    const intervalId = setInterval(fetchData, refetchInterval);
    return () => clearInterval(intervalId);
  }, [refetchInterval, fetchData]);
  
  return {
    data,
    result,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for ObjectQL mutations (create, update, delete)
 * 
 * @param dataSource - ObjectQL data source instance
 * @param resource - Resource name
 * @param options - Mutation options
 * @returns Mutation functions and state
 * 
 * @example
 * ```typescript
 * const { create, update, remove, loading, error } = useObjectQLMutation(
 *   dataSource,
 *   'contacts'
 * );
 * 
 * // Create a new record
 * await create({ name: 'John Doe', email: 'john@example.com' });
 * 
 * // Update a record
 * await update('123', { name: 'Jane Doe' });
 * 
 * // Delete a record
 * await remove('123');
 * ```
 */
export function useObjectQLMutation<T = any>(
  dataSource: ObjectQLDataSource,
  resource: string,
  options: UseObjectQLMutationOptions = {}
): {
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string | number, data: Partial<T>) => Promise<T>;
  remove: (id: string | number) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { onSuccess, onError } = options;
  
  const create = useCallback(async (data: Partial<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataSource.create(resource, data);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dataSource, resource, onSuccess, onError]);
  
  const update = useCallback(async (
    id: string | number, 
    data: Partial<T>
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataSource.update(resource, id, data);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dataSource, resource, onSuccess, onError]);
  
  const remove = useCallback(async (id: string | number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataSource.delete(resource, id);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dataSource, resource, onSuccess, onError]);
  
  return {
    create,
    update,
    remove,
    loading,
    error,
  };
}
