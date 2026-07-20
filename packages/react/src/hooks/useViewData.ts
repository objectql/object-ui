/**
 * ObjectUI — useViewData
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * A React hook that resolves a ViewData configuration into a DataSource
 * and provides reactive data fetching with loading/error states.
 */

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import type { DataSource, ViewData, QueryParams, QueryResult } from '@object-ui/types';
import { resolveDataSource, type ResolveDataSourceOptions } from '@object-ui/core';
import { SchemaRendererContext } from '../context/SchemaRendererContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseViewDataOptions<T = any> {
  /** The ViewData configuration from the schema */
  viewData?: ViewData | null;
  /** Resource name (object name, used for DataSource.find calls) */
  resource?: string;
  /** Initial query parameters */
  params?: QueryParams;
  /** Explicit data source override (bypasses context) */
  dataSource?: DataSource<T> | null;
  /** Options for adapter construction */
  adapterOptions?: ResolveDataSourceOptions;
  /** If true, skip the initial fetch (useful for forms in create mode) */
  skip?: boolean;
}

export interface UseViewDataResult<T = any> {
  /** Resolved data array */
  data: T[];
  /** Total number of records (from server or array length) */
  totalCount: number;
  /** Whether data is being fetched */
  loading: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** The resolved DataSource instance (can be used for create/update/delete) */
  dataSource: DataSource<T> | null;
  /** Re-fetch data with current or new params */
  refresh: (newParams?: QueryParams) => Promise<void>;
  /** Fetch a single record by ID */
  fetchOne: (id: string | number) => Promise<T | null>;
  /** Whether more records are available */
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useViewData — resolves ViewData into a DataSource and provides reactive data.
 *
 * This hook centralizes the data resolution pattern that was previously
 * duplicated across plugins (ObjectGrid, ObjectView, etc.). It:
 *
 * 1. Resolves the ViewData config to the right DataSource adapter
 *    - `provider: 'object'` → context DataSource (ObjectStackAdapter)
 *    - `provider: 'api'`    → ApiDataSource (raw HTTP)
 *    - `provider: 'value'`  → ValueDataSource (in-memory)
 * 2. Fetches data automatically on mount
 * 3. Provides loading/error states and refresh capability
 *
 * @example
 * ```tsx
 * function MyGrid({ schema }) {
 *   const { data, loading, error, refresh, dataSource } = useViewData({
 *     viewData: schema.data,
 *     resource: schema.objectName,
 *     params: { $top: 50 },
 *   });
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   return <Table data={data} />;
 * }
 * ```
 */
export function useViewData<T = any>(options: UseViewDataOptions<T>): UseViewDataResult<T> {
  const {
    viewData,
    resource = '',
    params,
    dataSource: explicitDataSource,
    adapterOptions,
    skip = false,
  } = options;

  // Get context DataSource + host-authenticated fetch
  const context = useContext(SchemaRendererContext);
  const contextDataSource = context?.dataSource ?? null;
  const contextApiFetch = context?.apiFetch;

  // Resolve the DataSource — memoize to prevent re-creation on every render.
  // We key on the viewData provider + config identity.
  const resolvedDataSource = useMemo(() => {
    if (explicitDataSource) return explicitDataSource;
    // Default the 'api' provider's fetch to the host's authenticated fetch
    // (SchemaRendererContext.apiFetch) so custom endpoints carry the same
    // credentials as native requests; explicit adapterOptions still win.
    return resolveDataSource<T>(viewData, contextDataSource, {
      fetch: contextApiFetch,
      ...adapterOptions,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    explicitDataSource,
    contextApiFetch,
    viewData?.provider,
    // For 'api' provider, key on read/write URLs
    viewData?.provider === 'api' ? (viewData as any).read?.url : undefined,
    viewData?.provider === 'api' ? (viewData as any).write?.url : undefined,
    // For 'value' provider, key on items reference (or length as proxy)
    viewData?.provider === 'value' ? (viewData as any).items?.length : undefined,
    contextDataSource,
  ]);

  // State
  const [data, setData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Stable params reference
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);

  // Fetch function
  const fetchData = useCallback(
    async (fetchParams?: QueryParams) => {
      if (!resolvedDataSource || !resource) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const mergedParams = fetchParams ?? (params ? { ...params } : undefined);
        const result: QueryResult<T> = await resolvedDataSource.find(resource, mergedParams);
        setData(result.data ?? []);
        setTotalCount(result.total ?? result.data?.length ?? 0);
        setHasMore(result.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setData([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [resolvedDataSource, resource, params],
  );

  // Auto-fetch on mount / when deps change
  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    // For value provider, data is synchronous — still go through fetchData
    // for consistency, but it resolves immediately.
    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedDataSource, resource, paramsKey, skip]);

  // Refresh function (can accept new params)
  const refresh = useCallback(
    async (newParams?: QueryParams) => {
      await fetchData(newParams);
    },
    [fetchData],
  );

  // Fetch one record
  const fetchOne = useCallback(
    async (id: string | number): Promise<T | null> => {
      if (!resolvedDataSource) return null;
      try {
        return await resolvedDataSource.findOne(resource, id);
      } catch {
        return null;
      }
    },
    [resolvedDataSource, resource],
  );

  return {
    data,
    totalCount,
    loading,
    error,
    dataSource: resolvedDataSource,
    refresh,
    fetchOne,
    hasMore,
  };
}
