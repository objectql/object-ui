import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Templates/Dashboard',
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
          value: '$45,231.89',
        }
      },
      { 
        id: 'metric-2',
        component: {
          type: 'metric', 
          label: 'Active Users',
          value: '2,350',
        }
      },
      { 
        id: 'metric-3',
        component: {
          type: 'metric', 
          label: 'Conversion Rate',
          value: '12.5%',
        }
      }
    ]
  } as any,
};

export const WithCards: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    columns: 2,
    gap: 6,
    widgets: [
      {
        id: 'card-1',
        title: 'Sales Overview',
        component: {
          type: 'card',
          children: [
            { type: 'metric', label: 'Today', value: '$1,234' },
            { type: 'metric', label: 'This Week', value: '$8,456' },
          ],
        }
      },
      {
        id: 'card-2',
        title: 'User Metrics',
        component: {
          type: 'card',
          children: [
            { type: 'metric', label: 'Online', value: '456' },
            { type: 'metric', label: 'New Today', value: '89' },
          ],
        }
      }
    ]
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
        id: 'metric-card-1',
        component: {
          type: 'metric-card',
          title: 'Total Revenue',
          value: '$45,231.89',
          icon: 'DollarSign',
          trend: 'up',
          trendValue: '+20.1%',
          description: 'from last month'
        },
        layout: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'metric-card-2',
        component: {
          type: 'metric-card',
          title: 'New Customers',
          value: '+2,350',
          icon: 'Users',
          trend: 'up',
          trendValue: '+180.1%',
          description: 'from last month'
        },
        layout: { x: 1, y: 0, w: 1, h: 1 }
      },
      {
        id: 'metric-card-3',
        component: {
          type: 'metric-card',
          title: 'Active Sessions',
          value: '+573',
          icon: 'Activity',
          trend: 'up',
          trendValue: '+201',
          description: 'since last hour'
        },
        layout: { x: 2, y: 0, w: 1, h: 1 }
      }
    ]
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
        id: 'metric-1',
        component: {
          type: 'metric-card',
          title: 'Total Revenue',
          value: '$45,231',
          icon: 'DollarSign',
          trend: 'up',
          trendValue: '+12%'
        },
        layout: { x: 0, y: 0, w: 1, h: 1 }
      },
      {
        id: 'metric-2',
        component: {
          type: 'metric-card',
          title: 'Orders',
          value: '856',
          icon: 'ShoppingCart',
          trend: 'up',
          trendValue: '+8%'
        },
        layout: { x: 1, y: 0, w: 1, h: 1 }
      },
      {
        id: 'metric-3',
        component: {
          type: 'metric-card',
          title: 'Bounce Rate',
          value: '2.4%',
          icon: 'TrendingDown',
          trend: 'down',
          trendValue: '-5%'
        },
        layout: { x: 2, y: 0, w: 1, h: 1 }
      },
      {
        id: 'chart-1',
        title: 'Revenue Overview',
        component: {
          type: 'chart',
          chartType: 'line',
          data: [
            { month: 'Jan', revenue: 4000 },
            { month: 'Feb', revenue: 3000 },
            { month: 'Mar', revenue: 6000 },
            { month: 'Apr', revenue: 8000 },
            { month: 'May', revenue: 5000 },
            { month: 'Jun', revenue: 7000 },
          ],
          xAxisKey: 'month',
          series: [{ dataKey: 'revenue' }],
          config: {
            revenue: { label: 'Revenue', color: '#10b981' }
          }
        },
        layout: { x: 0, y: 1, w: 3, h: 2 }
      }
    ]
  } as any,
};

export const WithGridLayout: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    name: 'sales_dashboard',
    title: 'Sales Analytics Dashboard',
    enableGridLayout: true,
    persistLayout: true,
    widgets: [
      {
        id: 'total-revenue',
        type: 'metric-card',
        title: 'Total Revenue',
        value: '$142,892',
        change: '+12.5%',
        trend: 'up',
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'new-customers',
        type: 'metric-card',
        title: 'New Customers',
        value: '847',
        change: '+8.2%',
        trend: 'up',
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'conversion-rate',
        type: 'metric-card',
        title: 'Conversion Rate',
        value: '3.24%',
        change: '-0.5%',
        trend: 'down',
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'revenue-chart',
        type: 'bar',
        title: 'Monthly Revenue',
        data: [
          { month: 'Jan', revenue: 12000 },
          { month: 'Feb', revenue: 15000 },
          { month: 'Mar', revenue: 18000 },
          { month: 'Apr', revenue: 14000 },
          { month: 'May', revenue: 20000 },
          { month: 'Jun', revenue: 22000 },
        ],
        xAxisKey: 'month',
        series: [{ dataKey: 'revenue' }],
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        id: 'top-products',
        type: 'table',
        title: 'Top Products',
        columns: ['Product', 'Sales', 'Revenue'],
        data: [
          { Product: 'Product A', Sales: 245, Revenue: '$12,450' },
          { Product: 'Product B', Sales: 189, Revenue: '$9,450' },
          { Product: 'Product C', Sales: 156, Revenue: '$7,800' },
        ],
        layout: { x: 6, y: 2, w: 3, h: 4 },
      },
    ],
  } as any,
};

export const EditableLayout: Story = {
  render: renderStory,
  args: {
    type: 'dashboard',
    name: 'custom_dashboard',
    title: 'Customizable Dashboard',
    enableGridLayout: true,
    enableEditMode: true,
    persistLayout: true,
    widgets: [
      {
        id: 'widget-1',
        type: 'metric-card',
        title: 'Metric 1',
        value: '1,234',
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'widget-2',
        type: 'metric-card',
        title: 'Metric 2',
        value: '5,678',
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'widget-3',
        type: 'line',
        title: 'Trend Chart',
        data: [
          { date: 'Mon', value: 100 },
          { date: 'Tue', value: 150 },
          { date: 'Wed', value: 130 },
          { date: 'Thu', value: 180 },
          { date: 'Fri', value: 200 },
        ],
        xAxisKey: 'date',
        series: [{ dataKey: 'value' }],
        layout: { x: 0, y: 2, w: 6, h: 3 },
      },
    ],
  } as any,
};
