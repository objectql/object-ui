/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardWithConfig } from './DashboardWithConfig';
import type { DashboardSchema } from '@object-ui/types';

// ─── WidgetConfigPanel Stories ──────────────────────────────────────────────

const widgetMeta = {
  title: 'Plugins/DashboardConfigPanel',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default widgetMeta;
type Story = StoryObj<typeof widgetMeta>;

// --- WidgetConfigPanel ---

const widgetConfig = {
  title: 'Revenue Chart',
  description: 'Monthly revenue by region',
  type: 'bar',
  object: 'orders',
  categoryField: 'region',
  valueField: 'amount',
  aggregate: 'sum',
  colorVariant: 'blue',
  actionUrl: '',
  layoutW: 2,
  layoutH: 1,
};

function WidgetConfigStory() {
  const [config, setConfig] = useState(widgetConfig);
  return (
    <div style={{ position: 'relative', height: 600, width: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <WidgetConfigPanel
        open={true}
        onClose={() => alert('Close clicked')}
        config={config}
        onSave={(newConfig) => {
          setConfig(newConfig as typeof widgetConfig);
          alert('Saved: ' + JSON.stringify(newConfig, null, 2));
        }}
      />
    </div>
  );
}

export const WidgetConfig: Story = {
  render: () => <WidgetConfigStory />,
};

// --- DashboardWithConfig ---

const dashboardSchema: DashboardSchema = {
  type: 'dashboard',
  title: 'Sales Dashboard',
  columns: 3,
  gap: 4,
  widgets: [
    {
      id: 'mc-1',
      component: {
        type: 'metric-card',
        title: 'Total Revenue',
        value: '$128,430',
        icon: 'DollarSign',
        trend: 'up',
        trendValue: '+14.2%',
      },
      layout: { x: 0, y: 0, w: 1, h: 1 },
    },
    {
      id: 'mc-2',
      component: {
        type: 'metric-card',
        title: 'Active Users',
        value: '3,842',
        icon: 'Users',
        trend: 'up',
        trendValue: '+8.1%',
      },
      layout: { x: 1, y: 0, w: 1, h: 1 },
    },
    {
      id: 'mc-3',
      component: {
        type: 'metric-card',
        title: 'Churn Rate',
        value: '1.8%',
        icon: 'TrendingDown',
        trend: 'down',
        trendValue: '-0.3%',
      },
      layout: { x: 2, y: 0, w: 1, h: 1 },
    },
  ],
  header: {
    showTitle: true,
    showDescription: true,
  },
};

const dashboardConfig = {
  columns: 3,
  gap: 4,
  rowHeight: '120',
  refreshInterval: '0',
  title: 'Sales Dashboard',
  showDescription: true,
  theme: 'auto',
};

function DashboardWithConfigStory() {
  const [config, setConfig] = useState(dashboardConfig);
  return (
    <div style={{ height: 600, width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <DashboardWithConfig
        schema={dashboardSchema}
        config={config}
        onConfigSave={(newConfig) => {
          setConfig(newConfig as typeof dashboardConfig);
        }}
        defaultConfigOpen={true}
      />
    </div>
  );
}

export const DashboardWithConfigPanel: Story = {
  render: () => <DashboardWithConfigStory />,
};

function DashboardWithConfigClosedStory() {
  const [config, setConfig] = useState(dashboardConfig);
  return (
    <div style={{ height: 600, width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <DashboardWithConfig
        schema={dashboardSchema}
        config={config}
        onConfigSave={(newConfig) => {
          setConfig(newConfig as typeof dashboardConfig);
        }}
        defaultConfigOpen={false}
      />
    </div>
  );
}

export const DashboardWithConfigClosed: Story = {
  render: () => <DashboardWithConfigClosedStory />,
};
