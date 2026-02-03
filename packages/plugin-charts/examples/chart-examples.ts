/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Example: Using all new chart types
 * 
 * This example demonstrates the new Pie, Donut, Radar, and Scatter chart types
 */

export const pieChartExample = {
  type: 'pie-chart',
  data: [
    { name: 'Chrome', value: 65 },
    { name: 'Firefox', value: 20 },
    { name: 'Safari', value: 10 },
    { name: 'Edge', value: 5 },
  ],
  xAxisKey: 'name',
  series: [{ dataKey: 'value' }],
  config: {
    Chrome: { label: 'Chrome', color: 'hsl(var(--chart-1))' },
    Firefox: { label: 'Firefox', color: 'hsl(var(--chart-2))' },
    Safari: { label: 'Safari', color: 'hsl(var(--chart-3))' },
    Edge: { label: 'Edge', color: 'hsl(var(--chart-4))' },
  }
};

export const donutChartExample = {
  type: 'donut-chart',
  data: [
    { category: 'Electronics', revenue: 45000 },
    { category: 'Clothing', revenue: 32000 },
    { category: 'Food', revenue: 28000 },
    { category: 'Books', revenue: 15000 },
  ],
  xAxisKey: 'category',
  series: [{ dataKey: 'revenue' }]
};

export const radarChartExample = {
  type: 'radar-chart',
  data: [
    { skill: 'React', score: 90 },
    { skill: 'TypeScript', score: 85 },
    { skill: 'Node.js', score: 80 }
  ],
  xAxisKey: 'skill',
  series: [{ dataKey: 'score' }]
};
