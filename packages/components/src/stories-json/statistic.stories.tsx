import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Data Display/Statistic',
  component: SchemaRenderer,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } }
  }
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'statistic',
    label: 'Total Revenue',
    value: '$45,231.89',
    icon: 'dollar-sign',
    trend: 'up',
    description: '+20.1% from last month',
    className: 'w-[300px]'
  } as any,
};

export const DownTrend: Story = {
  render: renderStory,
  args: {
    type: 'statistic',
    label: 'Bounce Rate',
    value: '42.3%',
    icon: 'activity',
    trend: 'down',
    description: '-5% better than average',
    className: 'w-[300px]'
  } as any,
};
