/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext } from 'react';
import { useDataScope, SchemaRendererContext } from '@object-ui/react';
import { extractRecords } from '@object-ui/core';
import { Skeleton, cn } from '@object-ui/components';
import { PivotTable } from './PivotTable';
import type { PivotTableSchema } from '@object-ui/types';

export interface ObjectPivotTableProps {
  schema: PivotTableSchema & {
    objectName?: string;
    dataProvider?: { provider: string; object?: string };
    bind?: string;
    filter?: any;
  };
  dataSource?: any;
  className?: string;
}

/**
 * ObjectPivotTable — Async-aware wrapper around PivotTable.
 *
 * When `objectName` is provided and a `dataSource` is available via context
 * or props, fetches records automatically and passes them to PivotTable.
 *
 * Lifecycle states:
 * - **Loading** → skeleton placeholder
 * - **Error** → error message
 * - **Empty** → friendly "No data available" (delegated to PivotTable)
 * - **Data** → PivotTable with fetched rows
 */
export const ObjectPivotTable: React.FC<ObjectPivotTableProps> = ({ schema, dataSource: propDataSource, className }) => {
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
        console.error('[ObjectPivotTable] Fetch error:', e);
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

  // Loading skeleton
  if (loading && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="pivot-loading">
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="space-y-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="pivot-error">
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-destructive" data-testid="pivot-error-message">
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
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">No data source available for &ldquo;{schema.objectName}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Delegate to PivotTable with resolved data
  const finalSchema: PivotTableSchema = {
    ...schema,
    data: finalData,
  };

  return <PivotTable schema={finalSchema} className={className} />;
};
