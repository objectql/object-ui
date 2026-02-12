
import React, { useState, useEffect } from 'react';
import { useDataScope, useSchemaContext } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry } from '@object-ui/core';

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
            // Apply filtering?
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
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter]);

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
    ]
});
