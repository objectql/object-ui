/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ChartBarRenderer, ChartRenderer } from './ChartRenderer';
import { ObjectChartBlock } from './ObjectChart';

// Export types for external use
export type { BarChartSchema } from './types';
export { ChartBarRenderer, ChartRenderer };
export { ObjectChart, ObjectChartBlock } from './ObjectChart';
// objectui#7946 — the prop type is part of the published surface, exactly as
// `plugin-list` exports `ObjectGalleryProps` (objectui#6576). A prop type that
// anchors a schema but is not exported cannot be asserted against by a consumer.
export type { ObjectChartProps } from './ObjectChart';

// The ONE place the author-facing chart schema is translated into the
// renderer's internal pipeline contract (#2880 S1). Published from this entry
// — the package's only door — because a consumer that wants to know what
// `AdvancedChartImpl` is actually handed has to run the schema through the SAME
// translation the runtime applies; restating the translation instead would make
// the assertion a copy of the thing under test (objectui#4529, #4471).
//
// Costs nothing to ship: `ChartRenderer` above already imports this module
// statically, so it is in this entry's eager graph either way. This adds a
// name, not a byte.
export { normalizeChartSchema } from './normalizeChartSchema';
export type { NormalizedChartSchema } from './normalizeChartSchema';

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
      { name: 'data', type: 'array', required: true },
      { name: 'dataKey', type: 'string' },
      { name: 'xAxisKey', type: 'string' },
      { name: 'height', type: 'number' },
      { name: 'color', type: 'color' },
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
// Alias for generic view. `chart` collides with the raw data
// `plugin-charts:chart` (ChartRenderer) registered below, which owns the bare
// `type: 'chart'` schema keyword; this object/aggregate-query variant is
// reached via `view:chart` only.
// `ObjectChartBlock` (not the bare `ObjectChart`) so this alias consumes the
// spec's per-element `dataSource` binding exactly as `object-chart` does —
// one block reached under two keys must not be bound under only one of them
// (objectstack#6953).
ComponentRegistry.register('chart', ObjectChartBlock, {
  namespace: 'view',
  category: 'view',
  label: 'Chart',
  skipFallback: true,
  inputs: [
    { name: 'objectName', type: 'string', required: true },
    { name: 'type', type: 'string' },
    { name: 'categoryField', type: 'string' },
    { name: 'valueField', type: 'string' },
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
        enum: [
          { label: 'Bar', value: 'bar' },
          { label: 'Line', value: 'line' },
          { label: 'Area', value: 'area' },
          { label: 'Pie', value: 'pie' },
          { label: 'Donut', value: 'donut' },
          { label: 'Radar', value: 'radar' },
          { label: 'Scatter', value: 'scatter' }
        ]      },
      { name: 'data', type: 'code', required: true },
      { name: 'config', type: 'code' },
      { name: 'xAxisKey', type: 'string' },
      { name: 'series', type: 'code', required: true },
      { name: 'className', type: 'string' }
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

/**
 * ⭐ The chart-family registrations below (`chart:bar`, `pie-chart`,
 * `donut-chart`, `radar-chart`, `scatter-chart`) declare their family in ONE
 * place, and it is not here: `CHART_TYPE_KEYWORD_FAMILIES` in
 * `normalizeChartSchema.ts`, which `ChartRenderer` resolves through on every
 * render.
 *
 * Until objectui#7401 each of them carried a second declaration —
 * `defaultProps: { chartType: … }` — that **nothing on the SDUI path has ever
 * read**. `SchemaRenderer` does not read a registration's `defaultProps`; the
 * tree's one consumer (`core/src/registry/WidgetRegistry.ts`) WRITES manifest
 * defaults into the registry and never reads these back. So all four of the
 * families below rendered as BAR charts — `AdvancedChartImpl`'s default — on
 * valid data, with no refusal that could fire. Ruled route C: derive the
 * family from the schema's own `type`, and the inert declaration goes with it
 * rather than sitting beside a mechanism that works (`AGENTS.md` #0.1).
 *
 * ⛔ Do not re-add `defaultProps: { chartType: … }` to a registration here. It
 * would read as the family's declaration while changing nothing, which is the
 * exact state this card removed. A NEW chart-family keyword is added to
 * `CHART_TYPE_KEYWORD_FAMILIES` in the same edit as its `register()` call —
 * `__tests__/chart-family-from-type-7401.test.tsx` fails on either half alone.
 *
 * ⚠️ `bar-chart` above is NOT one of these: it is registered to
 * `ChartBarRenderer`, a wrapper that sets the family itself and never reaches
 * `normalizeChartSchema`. Its own `defaultProps` is a sample-data seed, not a
 * family declaration, and stays.
 */
// Alias for CRM App compatibility
ComponentRegistry.register(
  'chart:bar',
  ChartRenderer, 
  {
    namespace: 'plugin-charts',
    label: 'Bar Chart (Alias)',
    category: 'plugin'
  }
);

ComponentRegistry.register(
  'pie-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Pie Chart',
    category: 'plugin'
  }
);

ComponentRegistry.register(
  'donut-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Donut Chart',
    category: 'plugin'
  }
);

ComponentRegistry.register(
  'radar-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Radar Chart',
    category: 'plugin'
  }
);

ComponentRegistry.register(
  'scatter-chart',
  ChartRenderer,
  {
    namespace: 'plugin-charts',
    label: 'Scatter Chart',
    category: 'plugin'
  }
);
