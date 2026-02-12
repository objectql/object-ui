import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/ObjectChart',
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
    type: 'chart',
    chartType: 'bar',
    data: [
      { month: 'Jan', revenue: 4200 },
      { month: 'Feb', revenue: 3800 },
      { month: 'Mar', revenue: 5100 },
      { month: 'Apr', revenue: 6300 },
      { month: 'May', revenue: 5800 },
      { month: 'Jun', revenue: 7200 },
    ],
    xAxisKey: 'month',
    series: [{ dataKey: 'revenue' }],
    config: {
      revenue: { label: 'Revenue', color: '#3b82f6' },
    },
  } as any,
};

export const LineChart: Story = {
  render: renderStory,
  args: {
    type: 'chart',
    chartType: 'line',
    data: [
      { month: 'Jan', users: 150, sessions: 520 },
      { month: 'Feb', users: 210, sessions: 680 },
      { month: 'Mar', users: 280, sessions: 910 },
      { month: 'Apr', users: 350, sessions: 1250 },
      { month: 'May', users: 430, sessions: 1600 },
      { month: 'Jun', users: 540, sessions: 2050 },
    ],
    config: {
      users: { label: 'Active Users', color: '#8b5cf6' },
      sessions: { label: 'Sessions', color: '#ec4899' },
    },
    xAxisKey: 'month',
    series: [{ dataKey: 'users' }, { dataKey: 'sessions' }],
  } as any,
};

export const PieChart: Story = {
  render: renderStory,
  args: {
    type: 'pie-chart',
    data: [
      { name: 'Desktop', value: 55 },
      { name: 'Mobile', value: 35 },
      { name: 'Tablet', value: 10 },
    ],
    xAxisKey: 'name',
    series: [{ dataKey: 'value' }],
    config: {
      Desktop: { label: 'Desktop', color: 'hsl(var(--chart-1))' },
      Mobile: { label: 'Mobile', color: 'hsl(var(--chart-2))' },
      Tablet: { label: 'Tablet', color: 'hsl(var(--chart-3))' },
    },
  } as any,
};

export const AreaChart: Story = {
  render: renderStory,
  args: {
    type: 'chart',
    chartType: 'area',
    data: [
      { date: 'Mon', traffic: 3200 },
      { date: 'Tue', traffic: 2800 },
      { date: 'Wed', traffic: 4100 },
      { date: 'Thu', traffic: 3600 },
      { date: 'Fri', traffic: 4800 },
      { date: 'Sat', traffic: 2900 },
      { date: 'Sun', traffic: 3400 },
    ],
    config: {
      traffic: { label: 'Page Views', color: '#06b6d4' },
    },
    xAxisKey: 'date',
    series: [{ dataKey: 'traffic' }],
  } as any,
};
