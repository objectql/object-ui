/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { DashboardRenderer } from './DashboardRenderer';
import { MetricWidget } from './MetricWidget';
import { MetricCard } from './MetricCard';
import { ReportRenderer } from './ReportRenderer';
import { ReportViewer } from './ReportViewer';
import { ReportBuilder } from './ReportBuilder';

export { DashboardRenderer, MetricWidget, MetricCard, ReportRenderer, ReportViewer, ReportBuilder };

// Register dashboard component
ComponentRegistry.register(
  'dashboard',
  DashboardRenderer,
  {
    namespace: 'plugin-dashboard',
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

// Register report component (legacy)
ComponentRegistry.register(
  'report',
  ReportRenderer,
  {
    namespace: 'plugin-dashboard',
    label: 'Report',
    category: 'Dashboard',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'description', type: 'string', label: 'Description' },
        { name: 'chart', type: 'code', label: 'Chart Configuration' },
    ]
  }
);

// Register report viewer component
ComponentRegistry.register(
  'report-viewer',
  ReportViewer,
  {
    namespace: 'plugin-dashboard',
    label: 'Report Viewer',
    category: 'Reports',
    inputs: [
        { name: 'report', type: 'code', label: 'Report Configuration', required: true },
        { name: 'data', type: 'code', label: 'Report Data' },
        { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar', defaultValue: true },
        { name: 'allowExport', type: 'boolean', label: 'Allow Export', defaultValue: true },
        { name: 'allowPrint', type: 'boolean', label: 'Allow Print', defaultValue: true },
    ]
  }
);

// Register report builder component
ComponentRegistry.register(
  'report-builder',
  ReportBuilder,
  {
    namespace: 'plugin-dashboard',
    label: 'Report Builder',
    category: 'Reports',
    inputs: [
        { name: 'report', type: 'code', label: 'Initial Report Config' },
        { name: 'dataSources', type: 'code', label: 'Available Data Sources' },
        { name: 'availableFields', type: 'code', label: 'Available Fields' },
        { name: 'showPreview', type: 'boolean', label: 'Show Preview', defaultValue: true },
    ]
  }
);

// Export all components
export const dashboardComponents = {
  'dashboard': DashboardRenderer,
  'metric': MetricWidget,
  'metric-card': MetricCard,
  'report': ReportRenderer,
  'report-viewer': ReportViewer,
  'report-builder': ReportBuilder,
};

