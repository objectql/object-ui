/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { DashboardRenderer } from './DashboardRenderer';
import { DashboardGridLayout } from './DashboardGridLayout';
import { MetricWidget } from './MetricWidget';
import { MetricCard } from './MetricCard';
import { PivotTable } from './PivotTable';
import { DashboardConfigPanel } from './DashboardConfigPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardWithConfig } from './DashboardWithConfig';

export { DashboardRenderer, DashboardGridLayout, MetricWidget, MetricCard, PivotTable, DashboardConfigPanel, WidgetConfigPanel, DashboardWithConfig };

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
      { name: 'persistLayoutKey', type: 'string', label: 'Layout Storage Key', defaultValue: 'dashboard-layout' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
        title: 'Dashboard',
        widgets: [],
        persistLayoutKey: 'dashboard-layout',
    }
  }
);

// Standard Export Protocol - for manual integration
export const dashboardComponents = {
  DashboardRenderer,
  DashboardGridLayout,
  MetricWidget,
  MetricCard,
  PivotTable,
  DashboardConfigPanel,
  WidgetConfigPanel,
  DashboardWithConfig,
};
