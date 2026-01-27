/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';
import type { ChartConfig } from './ChartContainerImpl';

// Export types for external use
export type { BarChartSchema } from './types';

// 🚀 Lazy load the implementation files
// This ensures Recharts is only loaded when the component is actually rendered
const LazyChart = React.lazy(() => import('./ChartImpl'));
const LazyAdvancedChart = React.lazy(() => import('./AdvancedChartImpl'));

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
  'bar-chart',
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

// Advanced Chart Renderer with multiple chart types
export interface ChartRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    chartType?: 'bar' | 'line' | 'area';
    data?: Array<Record<string, any>>;
    config?: Record<string, any>;
    xAxisKey?: string;
    series?: Array<{ dataKey: string }>;
  };
}

/**
 * ChartRenderer - The public API for the advanced chart component
 * Supports multiple chart types (bar, line, area) with full configuration
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({ schema }) => {
  // ⚡️ Adapter: Normalize JSON schema to Recharts Props
  const props = React.useMemo(() => {
    // 1. Defaults
    let series = schema.series;
    let xAxisKey = schema.xAxisKey;
    let config = schema.config;

    // 2. Adapt Tremor/Simple format (categories -> series, index -> xAxisKey)
    if (!xAxisKey) {
       if ((schema as any).index) xAxisKey = (schema as any).index;
       else if ((schema as any).category) xAxisKey = (schema as any).category; // Support Pie/Donut category
    }

    if (!series) {
       if ((schema as any).categories) {
          series = (schema as any).categories.map((cat: string) => ({ dataKey: cat }));
       } else if ((schema as any).value) {
          // Single value adapter (for Pie/Simple charts)
          series = [{ dataKey: (schema as any).value }];
       }
    }
    
    // 3. Auto-generate config/colors if missing
    if (!config && series) {
       const colors = (schema as any).colors || ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))']; 
       const newConfig: ChartConfig = {};
       series.forEach((s: any, idx: number) => {
         newConfig[s.dataKey] = { label: s.dataKey, color: colors[idx % colors.length] };
       });
       config = newConfig;
    }

    return {
      chartType: schema.chartType,
      data: schema.data,
      config,
      xAxisKey,
      series,
      className: schema.className
    };
  }, [schema]);

  return (
    <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
      <LazyAdvancedChart
        // Pass adapted props
        chartType={props.chartType}
        data={props.data}
        config={props.config}
        xAxisKey={props.xAxisKey}
        series={props.series}
        className={props.className}
      />
    </Suspense>
  );
};

// Register the advanced chart component
ComponentRegistry.register(
  'chart',
  ChartRenderer,
  {
    label: 'Chart',
    category: 'plugin',
    inputs: [
      { 
        name: 'chartType', 
        type: 'enum', 
        label: 'Chart Type',
        enum: [
          { label: 'Bar', value: 'bar' },
          { label: 'Line', value: 'line' },
          { label: 'Area', value: 'area' }
        ],
        defaultValue: 'bar'
      },
      { name: 'data', type: 'code', label: 'Data (JSON)', required: true },
      { name: 'config', type: 'code', label: 'Config (JSON)' },
      { name: 'xAxisKey', type: 'string', label: 'X Axis Key', defaultValue: 'name' },
      { name: 'series', type: 'code', label: 'Series (JSON Array)', required: true },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      chartType: 'bar',
      data: [
        { name: 'Jan', sales: 400, revenue: 240 },
        { name: 'Feb', sales: 300, revenue: 139 },
        { name: 'Mar', sales: 600, revenue: 380 },
        { name: 'Apr', sales: 800, revenue: 430 },
        { name: 'May', sales: 500, revenue: 220 },
      ],
      config: {
        sales: { label: 'Sales', color: '#8884d8' },
        revenue: { label: 'Revenue', color: '#82ca9d' }
      },
      xAxisKey: 'name',
      series: [
        { dataKey: 'sales' },
        { dataKey: 'revenue' }
      ]
    }
  }
);

// Standard Export Protocol - for manual integration
export const chartComponents = {
  'bar-chart': ChartBarRenderer,
  'chart': ChartRenderer,
};
