import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';

// Export types for external use
export type { BarChartSchema } from './types';

// 🚀 Lazy load the implementation file
// This ensures Recharts is only loaded when the component is actually rendered
const LazyChart = React.lazy(() => import('./ChartImpl'));

export interface ChartBarRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    data?: Array<Record<string, any>>;
    dataKey?: string;
    xAxisKey?: string;
    height?: number;
    color?: string;
  };
}

/**
 * ChartBarRenderer - The public API for the bar chart component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const ChartBarRenderer: React.FC<ChartBarRendererProps> = ({ schema }) => {
  return (
    <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
      <LazyChart
        data={schema.data}
        dataKey={schema.dataKey}
        xAxisKey={schema.xAxisKey}
        height={schema.height}
        className={schema.className}
        color={schema.color}
      />
    </Suspense>
  );
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'chart-bar',
  ChartBarRenderer,
  {
    label: 'Bar Chart',
    category: 'plugin',
    inputs: [
      { name: 'data', type: 'array', label: 'Data', required: true },
      { name: 'dataKey', type: 'string', label: 'Data Key', defaultValue: 'value' },
      { name: 'xAxisKey', type: 'string', label: 'X-Axis Key', defaultValue: 'name' },
      { name: 'height', type: 'number', label: 'Height', defaultValue: 400 },
      { name: 'color', type: 'color', label: 'Color', defaultValue: '#8884d8' },
    ],
    defaultProps: {
      data: [
        { name: 'Jan', value: 400 },
        { name: 'Feb', value: 300 },
        { name: 'Mar', value: 600 },
        { name: 'Apr', value: 800 },
        { name: 'May', value: 500 },
      ],
      dataKey: 'value',
      xAxisKey: 'name',
      height: 400,
      color: '#8884d8',
    },
  }
);

// Standard Export Protocol - for manual integration
export const chartComponents = {
  'chart-bar': ChartBarRenderer,
};
