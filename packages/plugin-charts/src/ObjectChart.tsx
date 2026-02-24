
import React, { useState, useEffect } from 'react';
import { useDataScope, useSchemaContext } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry } from '@object-ui/core';

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

export const ObjectChart = (props: any) => {
  const { schema } = props;
  const context = useSchemaContext();
  const dataSource = props.dataSource || context.dataSource;
  const boundData = useDataScope(schema.bind);
  
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        if (!dataSource || !schema.objectName) return;
        if (isMounted) setLoading(true);
        try {
            const results = await dataSource.find(schema.objectName, {
               $filter: schema.filter
            });
            
            let data: any[] = [];
            if (Array.isArray(results)) {
                data = results;
            } else if (results && typeof results === 'object') {
                if (Array.isArray((results as any).records)) {
                    data = (results as any).records;
                }
            }

            // Apply client-side aggregation when aggregate config is provided
            if (schema.aggregate && data.length > 0) {
                data = aggregateRecords(data, schema.aggregate);
            }

            if (isMounted) {
                setFetchedData(data);
            }
        } catch (e) {
            console.error('[ObjectChart] Fetch error:', e);
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    if (schema.objectName && !boundData && !schema.data) {
        fetchData();
    }
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, schema.aggregate]);

  const finalData = boundData || schema.data || fetchedData || [];

  // Merge data if not provided in schema
  const finalSchema = {
    ...schema,
    data: finalData
  };
  
  if (loading && finalData.length === 0) {
      // Return skeleton or loading state?
      // ChartRenderer has suspense/skeleton handling but needs to be triggered.
      // We pass empty data but it might render empty chart.
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
