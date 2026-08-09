/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ElementDataSourceGate, type ElementDataSourceMapping } from '@object-ui/react';
import { DashboardRenderer } from './DashboardRenderer';
import { DashboardGridLayout } from './DashboardGridLayout';
import { MetricWidget } from './MetricWidget';
import { MetricCard } from './MetricCard';
import { ObjectMetricWidget } from './ObjectMetricWidget';
import { PivotTable } from './PivotTable';
import { ObjectPivotTable } from './ObjectPivotTable';
import { ObjectDataTable } from './ObjectDataTable';
import { DashboardConfigPanel } from './DashboardConfigPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardWithConfig } from './DashboardWithConfig';
import { DrillDownDrawer } from './DrillDownDrawer';

export { DashboardRenderer, DashboardGridLayout, MetricWidget, MetricCard, ObjectMetricWidget, PivotTable, ObjectPivotTable, ObjectDataTable, DashboardConfigPanel, WidgetConfigPanel, DashboardWithConfig, DrillDownDrawer };
export type { WidgetConfigPanelProps } from './WidgetConfigPanel';
export type {
  WidgetDatasetCatalogEntry,
  WidgetDatasetDimension,
  WidgetDatasetMeasure,
} from './dataset-catalog';

// Register dashboard component
ComponentRegistry.register(
  'dashboard',
  DashboardRenderer,
  {
    namespace: 'view',
    label: 'Dashboard',
    category: 'Complex',
    icon: 'layout-dashboard',
    inputs: [
      { name: 'columns', type: 'number', label: 'Columns', defaultValue: 3 },
      { name: 'gap', type: 'number', label: 'Gap', defaultValue: 4 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
        columns: 3,
        widgets: []
    }
  }
);

// Register metric widget (legacy)
ComponentRegistry.register(
  'metric',
  MetricWidget,
  {
    namespace: 'plugin-dashboard',
    label: 'Metric Widget',
    category: 'Dashboard',
    inputs: [
        { name: 'label', type: 'string', label: 'Label' },
        { name: 'value', type: 'string', label: 'Value' },
    ]
  }
);

// Register metric card (new standalone component)
ComponentRegistry.register(
  'metric-card',
  MetricCard,
  {
    namespace: 'plugin-dashboard',
    label: 'Metric Card',
    category: 'Dashboard',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'value', type: 'string', label: 'Value', required: true },
        { name: 'icon', type: 'string', label: 'Icon (Lucide name)' },
        { name: 'trend', type: 'enum', label: 'Trend', enum: [
          { label: 'Up', value: 'up' },
          { label: 'Down', value: 'down' },
          { label: 'Neutral', value: 'neutral' }
        ]},
        { name: 'trendValue', type: 'string', label: 'Trend Value (e.g., +12%)' },
        { name: 'description', type: 'string', label: 'Description' },
    ],
    defaultProps: {
      title: 'Metric',
      value: '0'
    }
  }
);

/**
 * What `ObjectMetricWidget` reads for its own query: the object it aggregates
 * and the filter it aggregates over. A metric is ONE aggregated number — there
 * is no projection, no ordering and no page — so `columns` / `sort` / `limit`
 * have no read site here and are left unmapped rather than written to a key the
 * widget ignores.
 */
const OBJECT_METRIC_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
};

/**
 * Registry shell for `object-metric` — the spec's per-element `dataSource`
 * binding onto the props {@link ObjectMetricWidget} reads (objectstack#6953).
 *
 * This widget is registered directly and takes `objectName` / `filter` as PROPS
 * (`SchemaRenderer` spreads the schema's own keys onto it), so the binding had
 * no path in at all: a metric authored with `dataSource: { object, view }` and
 * no flat `objectName` fell through to the widget's no-object branch and showed
 * its static fallback value — a number that looks real and answers nothing.
 *
 * The props keep their standing when there is no binding: `bound` IS the schema
 * by reference in that case, so `bound?.x ?? props.x` resolves to what the
 * spread already provided, and a host that renders this component with explicit
 * props and no schema at all (the dashboard grid path) is untouched.
 */
const ObjectMetricBlock: React.FC<{ schema?: any; [key: string]: any }> = ({ schema, ...props }) => (
  <ElementDataSourceGate
    schema={schema}
    mapping={OBJECT_METRIC_DATA_SOURCE}
    dataSource={props.dataSource}
    testId="object-metric"
    errorTitle="This metric’s data source could not be resolved"
  >
    {(bound) => (
      <ObjectMetricWidget
        {...(props as any)}
        objectName={bound?.objectName ?? props.objectName}
        filter={bound?.filter ?? props.filter}
      />
    )}
  </ElementDataSourceGate>
);

// Register object-aware metric widget (async data loading with error states)
ComponentRegistry.register(
  'object-metric',
  ObjectMetricBlock,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Metric',
    category: 'Dashboard',
    inputs: [
        { name: 'objectName', type: 'string', label: 'Object Name', required: true },
        { name: 'label', type: 'string', label: 'Label' },
        { name: 'aggregate', type: 'object', label: 'Aggregate', description: 'Aggregation config: { field, function, groupBy }' },
        { name: 'icon', type: 'string', label: 'Icon (Lucide name)' },
    ],
    defaultProps: {
      label: 'Metric',
    }
  }
);

// Register pivot table component
ComponentRegistry.register(
  'pivot',
  PivotTable,
  {
    namespace: 'plugin-dashboard',
    label: 'Pivot Table',
    category: 'Dashboard',
    icon: 'table-2',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'rowField', type: 'string', label: 'Row Field', required: true },
      { name: 'columnField', type: 'string', label: 'Column Field', required: true },
      { name: 'valueField', type: 'string', label: 'Value Field', required: true },
      { name: 'aggregation', type: 'enum', label: 'Aggregation', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean', label: 'Show Row Totals' },
      { name: 'showColumnTotals', type: 'boolean', label: 'Show Column Totals' },
      { name: 'format', type: 'string', label: 'Number Format' },
    ],
    defaultProps: {
      rowField: '',
      columnField: '',
      valueField: '',
      aggregation: 'sum',
      data: [],
    }
  }
);

/**
 * What `ObjectPivotTable` reads for its own query: the object it cross-tabs and
 * the filter it cross-tabs over (`ObjectPivotTable.tsx` —
 * `dataSource.find(schema.objectName, { $filter: resolveFilterPlaceholders(schema.filter, …) })`).
 *
 * `sort` / `limit` / `columns` are deliberately unmapped, none of them having a
 * read site here: a pivot's ordering comes out of its own row/column grouping
 * (`rowField` / `columnField`), its fetch issues no `$top` because a cross-tab
 * over a truncated page would report wrong totals, and its "columns" are the
 * `columnField` VALUES, not a field projection a saved view could supply.
 */
const OBJECT_PIVOT_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
};

/**
 * Registry shell for `object-pivot` — the spec's per-element `dataSource`
 * binding onto the schema keys {@link ObjectPivotTable} reads (objectstack#7121).
 *
 * Without it a pivot authored the way the spec documents (`dataSource: { object,
 * view }`, no flat `objectName`) fell through the `if (!dataSource ||
 * !schema.objectName) return;` guard in its fetch effect: an empty cross-tab, no
 * request, no diagnostic. Same shape the sibling `object-metric` above had.
 *
 * Props pass through untouched, and `bound` IS the schema by reference when there
 * is no binding — so the dashboard/manual paths that render this component with a
 * plain schema behave exactly as before.
 */
const ObjectPivotBlock: React.FC<{ schema?: any; [key: string]: any }> = ({ schema, ...props }) => (
  <ElementDataSourceGate
    schema={schema}
    mapping={OBJECT_PIVOT_DATA_SOURCE}
    dataSource={props.dataSource}
    testId="object-pivot"
    errorTitle="This pivot table’s data source could not be resolved"
  >
    {(bound) => <ObjectPivotTable {...(props as any)} schema={bound as any} />}
  </ElementDataSourceGate>
);

// Register object-aware pivot table (async data loading)
ComponentRegistry.register(
  'object-pivot',
  ObjectPivotBlock,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Pivot Table',
    category: 'Dashboard',
    icon: 'table-2',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'rowField', type: 'string', label: 'Row Field', required: true },
      { name: 'columnField', type: 'string', label: 'Column Field', required: true },
      { name: 'valueField', type: 'string', label: 'Value Field', required: true },
      { name: 'aggregation', type: 'enum', label: 'Aggregation', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean', label: 'Show Row Totals' },
      { name: 'showColumnTotals', type: 'boolean', label: 'Show Column Totals' },
      { name: 'filter', type: 'array', label: 'Filter' },
      { name: 'format', type: 'string', label: 'Number Format' },
    ],
    defaultProps: {
      rowField: '',
      columnField: '',
      valueField: '',
      aggregation: 'sum',
    }
  }
);

// Register dashboard grid layout component
ComponentRegistry.register(
  'dashboard-grid',
  DashboardGridLayout,
  {
    namespace: 'plugin-dashboard',
    label: 'Dashboard Grid (Editable)',
    category: 'Complex',
    icon: 'layout-grid',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
        title: 'Dashboard',
        widgets: [],
    }
  }
);

// Register object-aware data table (async data loading)
ComponentRegistry.register(
  'object-data-table',
  ObjectDataTable,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Data Table',
    category: 'Dashboard',
    icon: 'table',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'columns', type: 'array', label: 'Columns' },
      { name: 'filter', type: 'array', label: 'Filter' },
      { name: 'searchable', type: 'boolean', label: 'Searchable' },
      { name: 'pagination', type: 'boolean', label: 'Pagination' },
    ],
    defaultProps: {
      searchable: false,
      pagination: false,
    }
  }
);

// Standard Export Protocol - for manual integration
export const dashboardComponents = {
  DashboardRenderer,
  DashboardGridLayout,
  MetricWidget,
  MetricCard,
  ObjectMetricWidget,
  PivotTable,
  ObjectPivotTable,
  ObjectDataTable,
  DashboardConfigPanel,
  WidgetConfigPanel,
  DashboardWithConfig,
};
