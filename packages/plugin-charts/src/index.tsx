/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ChartBarRenderer, ChartRenderer } from './ChartRenderer';
import { ObjectChart } from './ObjectChart';

// Export types for external use
export type { BarChartSchema } from './types';
export { ChartBarRenderer, ChartRenderer };
export { ObjectChart } from './ObjectChart';

// Standard Export Protocol - for manual integration
export const chartComponents = {
  'bar-chart': ChartBarRenderer,
  'chart': ChartRenderer,
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'bar-chart',
  ChartBarRenderer,
  {
    namespace: 'plugin-charts',
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
// Alias for generic view
ComponentRegistry.register('chart', ObjectChart, {
  namespace: 'view',
  category: 'view',
  label: 'Chart',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'type', type: 'string', label: 'Chart Type' },
    { name: 'categoryField', type: 'string', label: 'Category Field' },
    { name: 'valueField', type: 'string', label: 'Value Field' },
  ]
});
// Register the advanced chart component
ComponentRegistry.register(
  'chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
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
          { label: 'Area', value: 'area' },
          { label: 'Pie', value: 'pie' },
          { label: 'Donut', value: 'donut' },
          { label: 'Radar', value: 'radar' },
          { label: 'Scatter', value: 'scatter' }
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

// Alias for CRM App compatibility
ComponentRegistry.register(
  'chart:bar',
  ChartRenderer, 
  {
    namespace: 'plugin-charts',
    label: 'Bar Chart (Alias)',
    category: 'plugin',
    defaultProps: { chartType: 'bar' }
  }
);

ComponentRegistry.register(
  'pie-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Pie Chart',
    category: 'plugin',
    defaultProps: { chartType: 'pie' }
  }
);

ComponentRegistry.register(
  'donut-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Donut Chart',
    category: 'plugin',
    defaultProps: { chartType: 'donut' }
  }
);

ComponentRegistry.register(
  'radar-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Radar Chart',
    category: 'plugin',
    defaultProps: { chartType: 'radar' }
  }
);

ComponentRegistry.register(
  'scatter-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Scatter Chart',
    category: 'plugin',
    defaultProps: { chartType: 'scatter' }
  }
);
