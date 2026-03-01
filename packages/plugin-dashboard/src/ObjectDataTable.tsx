/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer } from '@object-ui/react';
import { extractRecords } from '@object-ui/core';
import { Skeleton, cn } from '@object-ui/components';

export interface ObjectDataTableProps {
  schema: {
    type: string;
    objectName?: string;
    dataProvider?: { provider: string; object?: string };
    bind?: string;
    filter?: any;
    data?: any[];
    columns?: any[];
    searchable?: boolean;
    pagination?: boolean;
    className?: string;
    [key: string]: any;
  };
  dataSource?: any;
  className?: string;
}

/**
 * ObjectDataTable — Async-aware wrapper for data-table.
 *
 * When `objectName` is provided and a `dataSource` is available via context
 * or props, fetches records automatically and passes them to the registered
 * `data-table` component via SchemaRenderer.
 *
 * Also auto-derives columns from fetched data keys when no explicit columns
 * are configured.
 *
 * Lifecycle states:
 * - **Loading** → skeleton placeholder
 * - **Error** → error message
 * - **Empty** → friendly "No data available" message
 * - **Data** → data-table with fetched rows
 */
export const ObjectDataTable: React.FC<ObjectDataTableProps> = ({ schema, dataSource: propDataSource, className }) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!dataSource || !schema.objectName) return;
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        let data: any[];

        if (typeof dataSource.find === 'function') {
          const results = await dataSource.find(schema.objectName, {
            $filter: schema.filter,
          });
          data = extractRecords(results);
        } else {
          return;
        }

        if (isMounted) {
          setFetchedData(data);
        }
      } catch (e) {
        console.error('[ObjectDataTable] Fetch error:', e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (schema.objectName && !boundData && (!schema.data || schema.data.length === 0)) {
      fetchData();
    }

    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter]);

  // Resolve data: bound data > static schema data > fetched data
  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : [];

  // Auto-derive columns from data keys when none are provided
  const derivedColumns = useMemo(() => {
    if (schema.columns && schema.columns.length > 0) return schema.columns;
    if (finalData.length === 0) return [];
    // Exclude internal/private fields (prefixed with '_') from auto-derived columns
    const keys = Object.keys(finalData[0]).filter(k => !k.startsWith('_'));
    // Convert camelCase keys to human-readable headers (e.g. firstName → First Name)
    return keys.map(k => ({
      header: k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1'),
      accessorKey: k,
    }));
  }, [schema.columns, finalData]);

  // Loading skeleton
  if (loading && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-loading">
        <div className="space-y-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-error">
        <div className="flex flex-col items-center justify-center py-8 text-destructive" data-testid="table-error-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  // No data source available but objectName configured
  if (!dataSource && schema.objectName && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">No data source available for &ldquo;{schema.objectName}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-empty-state">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <p className="text-xs">No data available</p>
        </div>
      </div>
    );
  }

  // Delegate to data-table via SchemaRenderer
  const tableSchema = {
    ...schema,
    type: 'data-table',
    data: finalData,
    columns: derivedColumns,
  };

  return <SchemaRenderer schema={tableSchema} className={className} />;
};
