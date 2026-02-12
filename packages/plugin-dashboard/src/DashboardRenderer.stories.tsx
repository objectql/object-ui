import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/DashboardRenderer',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    columns: 3,
    gap: 4,
    widgets: [
      {
        id: 'metric-1',
        component: {
          type: 'metric',
          label: 'Total Revenue',
          value: '$128,430',
        },
      },
      {
        id: 'metric-2',
        component: {
          type: 'metric',
          label: 'Active Users',
          value: '3,842',
        },
      },
      {
        id: 'metric-3',
        component: {
          type: 'metric',
          label: 'Conversion Rate',
          value: '4.2%',
        },
      },
    ],
  } as any,
};

export const WithMetricCards: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    columns: 3,
    gap: 4,
    widgets: [
      {
        id: 'mc-1',
        component: {
          type: 'metric-card',
          title: 'Monthly Revenue',
          value: '$52,489',
          icon: 'DollarSign',
          trend: 'up',
          trendValue: '+14.2%',
          description: 'vs last month',
        },
        layout: { x: 0, y: 0, w: 1, h: 1 },
      },
      {
        id: 'mc-2',
        component: {
          type: 'metric-card',
          title: 'New Signups',
          value: '1,205',
          icon: 'Users',
          trend: 'up',
          trendValue: '+8.1%',
          description: 'vs last month',
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
          description: 'vs last month',
        },
        layout: { x: 2, y: 0, w: 1, h: 1 },
      },
    ],
  } as any,
};

export const WithChartsAndMetrics: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    columns: 3,
    gap: 4,
    widgets: [
      {
        id: 'd-m1',
        component: {
          type: 'metric-card',
          title: 'Total Orders',
          value: '1,284',
          icon: 'ShoppingCart',
          trend: 'up',
          trendValue: '+11%',
        },
        layout: { x: 0, y: 0, w: 1, h: 1 },
      },
      {
        id: 'd-m2',
        component: {
          type: 'metric-card',
          title: 'Avg Order Value',
          value: '$86.50',
          icon: 'DollarSign',
          trend: 'up',
          trendValue: '+3.2%',
        },
        layout: { x: 1, y: 0, w: 1, h: 1 },
      },
      {
        id: 'd-m3',
        component: {
          type: 'metric-card',
          title: 'Return Rate',
          value: '2.1%',
          icon: 'TrendingDown',
          trend: 'down',
          trendValue: '-0.8%',
        },
        layout: { x: 2, y: 0, w: 1, h: 1 },
      },
      {
        id: 'd-chart',
        title: 'Weekly Sales',
        component: {
          type: 'chart',
          chartType: 'bar',
          data: [
            { day: 'Mon', sales: 120 },
            { day: 'Tue', sales: 180 },
            { day: 'Wed', sales: 150 },
            { day: 'Thu', sales: 210 },
            { day: 'Fri', sales: 190 },
          ],
          xAxisKey: 'day',
          series: [{ dataKey: 'sales' }],
          config: {
            sales: { label: 'Sales', color: '#3b82f6' },
          },
        },
        layout: { x: 0, y: 1, w: 3, h: 2 },
      },
    ],
  } as any,
};
