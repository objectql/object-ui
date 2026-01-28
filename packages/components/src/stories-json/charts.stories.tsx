import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Charts',
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

export const BarChart: Story = {
  render: renderStory,
  args: {
    type: 'bar-chart',
    data: [
      { name: 'Jan', value: 400 },
      { name: 'Feb', value: 300 },
      { name: 'Mar', value: 600 },
      { name: 'Apr', value: 800 },
      { name: 'May', value: 500 },
      { name: 'Jun', value: 700 }
    ],
    dataKey: 'value',
    xAxisKey: 'name',
    height: 400,
    color: '#3b82f6'
  } as any,
};

export const MultiSeriesChart: Story = {
  render: renderStory,
  args: {
    type: 'chart',
    chartType: 'bar',
    data: [
      { name: 'Jan', sales: 400, revenue: 240 },
      { name: 'Feb', sales: 300, revenue: 139 },
      { name: 'Mar', sales: 600, revenue: 380 },
      { name: 'Apr', sales: 800, revenue: 430 },
      { name: 'May', sales: 500, revenue: 220 },
      { name: 'Jun', sales: 700, revenue: 350 }
    ],
    config: {
      sales: { label: 'Sales', color: '#3b82f6' },
      revenue: { label: 'Revenue', color: '#10b981' }
    },
    xAxisKey: 'name',
    series: [
      { dataKey: 'sales' },
      { dataKey: 'revenue' }
    ]
  } as any,
};

export const LineChart: Story = {
  render: renderStory,
  args: {
    type: 'chart',
    chartType: 'line',
    data: [
      { month: 'Jan', users: 120, sessions: 450 },
      { month: 'Feb', users: 180, sessions: 620 },
      { month: 'Mar', users: 250, sessions: 890 },
      { month: 'Apr', users: 320, sessions: 1200 },
      { month: 'May', users: 410, sessions: 1560 },
      { month: 'Jun', users: 520, sessions: 1980 }
    ],
    config: {
      users: { label: 'Active Users', color: '#8b5cf6' },
      sessions: { label: 'Sessions', color: '#ec4899' }
    },
    xAxisKey: 'month',
    series: [
      { dataKey: 'users' },
      { dataKey: 'sessions' }
    ]
  } as any,
};

export const AreaChart: Story = {
  render: renderStory,
  args: {
    type: 'chart',
    chartType: 'area',
    data: [
      { date: 'Mon', traffic: 2400 },
      { date: 'Tue', traffic: 1398 },
      { date: 'Wed', traffic: 9800 },
      { date: 'Thu', traffic: 3908 },
      { date: 'Fri', traffic: 4800 },
      { date: 'Sat', traffic: 3800 },
      { date: 'Sun', traffic: 4300 }
    ],
    config: {
      traffic: { label: 'Website Traffic', color: '#06b6d4' }
    },
    xAxisKey: 'date',
    series: [
      { dataKey: 'traffic' }
    ]
  } as any,
};
