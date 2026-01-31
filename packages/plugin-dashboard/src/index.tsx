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

export { DashboardRenderer, MetricWidget };

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

// Register metric component
ComponentRegistry.register(
  'metric',
  MetricWidget,
  {
    namespace: 'plugin-dashboard',
    label: 'Metric Card',
    category: 'Dashboard',
    inputs: [
        { name: 'label', type: 'string', label: 'Label' },
        { name: 'value', type: 'string', label: 'Value' },
    ]
  }
);
