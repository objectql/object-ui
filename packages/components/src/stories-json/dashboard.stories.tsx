import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Plugins/Dashboard',
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
    children: [
      { 
        type: 'metric', 
        label: 'Total Revenue',
        value: '$45,231.89',
        className: 'col-span-1'
      },
      { 
        type: 'metric', 
        label: 'Active Users',
        value: '2,350',
        className: 'col-span-1'
      },
      { 
        type: 'metric', 
        label: 'Conversion Rate',
        value: '12.5%',
        className: 'col-span-1'
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
    children: [
      {
        type: 'card',
        title: 'Sales Overview',
        children: [
          { type: 'metric', label: 'Today', value: '$1,234' },
          { type: 'metric', label: 'This Week', value: '$8,456' },
        ],
        className: 'col-span-1'
      },
      {
        type: 'card',
        title: 'User Metrics',
        children: [
          { type: 'metric', label: 'Online', value: '456' },
          { type: 'metric', label: 'New Today', value: '89' },
        ],
        className: 'col-span-1'
      }
    ]
  } as any,
};
