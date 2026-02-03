import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Components/Data Display/Metric Card',
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
    type: 'metric-card',
    title: 'Total Revenue',
    value: '$45,231.89',
  } as any,
};

export const WithIcon: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Total Revenue',
    value: '$45,231.89',
    icon: 'DollarSign',
  } as any,
};

export const WithTrendUp: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Total Revenue',
    value: '$45,231.89',
    icon: 'DollarSign',
    trend: 'up',
    trendValue: '+20.1%',
    description: 'from last month'
  } as any,
};

export const WithTrendDown: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Bounce Rate',
    value: '2.4%',
    icon: 'TrendingDown',
    trend: 'down',
    trendValue: '-5.2%',
    description: 'from last month'
  } as any,
};

export const WithTrendNeutral: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Active Users',
    value: '1,234',
    icon: 'Users',
    trend: 'neutral',
    trendValue: '0%',
    description: 'no change'
  } as any,
};

export const MultipleMetrics: Story = {
  render: renderStory,
  args: {
    type: 'flex',
    direction: 'row',
    gap: 4,
    children: [
      {
        type: 'metric-card',
        title: 'Total Revenue',
        value: '$45,231.89',
        icon: 'DollarSign',
        trend: 'up',
        trendValue: '+20.1%',
        description: 'from last month',
        className: 'flex-1'
      },
      {
        type: 'metric-card',
        title: 'New Customers',
        value: '+2,350',
        icon: 'Users',
        trend: 'up',
        trendValue: '+180.1%',
        description: 'from last month',
        className: 'flex-1'
      },
      {
        type: 'metric-card',
        title: 'Active Sessions',
        value: '+573',
        icon: 'Activity',
        trend: 'up',
        trendValue: '+201',
        description: 'since last hour',
        className: 'flex-1'
      }
    ]
  } as any,
};

export const LargeNumbers: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Total Views',
    value: '1,234,567',
    icon: 'Eye',
    trend: 'up',
    trendValue: '+45.2%',
    description: 'from last quarter'
  } as any,
};

export const WithDescription: Story = {
  render: renderStory,
  args: {
    type: 'metric-card',
    title: 'Conversion Rate',
    value: '12.5%',
    icon: 'Target',
    description: 'above industry average'
  } as any,
};
