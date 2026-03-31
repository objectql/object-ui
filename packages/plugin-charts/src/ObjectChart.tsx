
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useDataScope, SchemaRendererContext } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry, extractRecords } from '@object-ui/core';
import { AlertCircle } from 'lucide-react';

/**
 * Client-side aggregation for fetched records.
 * Groups records by `groupBy` field and applies the aggregation function
 * to the `field` values in each group.
 */
export function aggregateRecords(
  records: any[],
  aggregate: { field: string; function: string; groupBy: string }
): any[] {
  const { field, function: aggFn, groupBy } = aggregate;
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
      case 'count':
        result = group.length;
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'sum':
      default:
        result = values.reduce((a, b) => a + b, 0);
        break;
    }

    return { [groupBy]: key, [field]: result };
  });
}

// Re-export extractRecords from @object-ui/core for backward compatibility
export { extractRecords } from '@object-ui/core';

export const ObjectChart = (props: any) => {
  const { schema } = props;
  const context = useContext(SchemaRendererContext);
  const dataSource = props.dataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);
  
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (ds: any, mounted: { current: boolean }) => {
      if (!ds || !schema.objectName) return;
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }
      try {
          let data: any[];

          // Prefer server-side aggregation when aggregate config is provided
          // and dataSource supports the aggregate() method.
          if (schema.aggregate && typeof ds.aggregate === 'function') {
              const results = await ds.aggregate(schema.objectName, {
                  field: schema.aggregate.field,
                  function: schema.aggregate.function,
                  groupBy: schema.aggregate.groupBy,
                  filter: schema.filter,
              });
              data = Array.isArray(results) ? results : [];
          } else if (typeof ds.find === 'function') {
              // Fallback: fetch all records and aggregate client-side
              const results = await ds.find(schema.objectName, {
                 $filter: schema.filter
              });
              
              data = extractRecords(results);

              // Apply client-side aggregation when aggregate config is provided
              if (schema.aggregate && data.length > 0) {
                  data = aggregateRecords(data, schema.aggregate);
              }
          } else {
              return;
          }

          if (mounted.current) {
              setFetchedData(data);
          }
      } catch (e) {
          console.error('[ObjectChart] Fetch error:', e);
          if (mounted.current) {
              setError(e instanceof Error ? e.message : 'Failed to load chart data');
          }
      } finally {
          if (mounted.current) setLoading(false);
      }
  }, [schema.objectName, schema.aggregate, schema.filter]);

  useEffect(() => {
    const mounted = { current: true };

    if (schema.objectName && !boundData && !schema.data) {
        fetchData(dataSource, mounted);
    }
    return () => { mounted.current = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, schema.aggregate, fetchData]);

  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : [];

  // Merge data if not provided in schema
  const finalSchema = {
    ...schema,
    data: finalData
  };
  
  if (loading && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-loading">Loading chart data…</div>;
  }

  // Error state — show the error prominently so issues are not hidden
  if (error) {
      return (
        <div className={"flex flex-col items-center justify-center gap-2 p-4 " + (schema.className || '')} data-testid="chart-error" role="alert">
          <AlertCircle className="h-6 w-6 text-destructive opacity-60" />
          <p className="text-xs text-destructive font-medium">Failed to load chart data</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">{error}</p>
        </div>
      );
  }

  if (!dataSource && schema.objectName && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-no-datasource">No data source available for &ldquo;{schema.objectName}&rdquo;</div>;
  }

  return <ChartRenderer {...props} schema={finalSchema} />;
};

// Register it
ComponentRegistry.register('object-chart', ObjectChart, {
    namespace: 'plugin-charts',
    label: 'Object Chart',
    category: 'view',
    inputs: [
        { name: 'objectName', type: 'string', label: 'Object Name', required: true },
        { name: 'data', type: 'array', label: 'Data', description: 'Optional static data' },
        { name: 'filter', type: 'array', label: 'Filter' },
        { name: 'aggregate', type: 'object', label: 'Aggregate', description: 'Aggregation config: { field, function, groupBy }' },
    ]
});
