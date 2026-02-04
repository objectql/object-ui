
import React from 'react';
import { useDataScope } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry } from '@object-ui/core';

export const ObjectChart = (props: any) => {
  const { schema } = props;
  const { data, isLoading } = useDataScope();

  // Merge data if not provided in schema
  const finalSchema = {
    ...schema,
    data: schema.data || data?.value || data || [] // handle { value: [] } from OData
  };
  
  // If we are bound to an object but no data, we might want to wait or show empty state
  // ChartRenderer handles empty data gracefully usually.

  return <ChartRenderer {...props} schema={finalSchema} />;
};

// Register it
ComponentRegistry.register('object-chart', ObjectChart, {
    namespace: 'plugin-charts',
    label: 'Object Chart',
    category: 'view'
});
