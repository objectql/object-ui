import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Layout/Page',
  component: SchemaRenderer,
  parameters: { layout: 'fullscreen' },
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
    type: 'page',
    title: 'Dashboard',
    description: 'Overview of your project analysis.',
    children: [
        { 
            type: 'grid', 
            props: { cols: { base: 1, md: 3 }, gap: 4 },
            children: [
                { type: 'statistic', label: 'Total Revenue', value: '$45,231.89', trend: 'up', description: '+20.1% from last month' },
                { type: 'statistic', label: 'Subscriptions', value: '+2350', trend: 'up', description: '+180.1% from last month' },
                { type: 'statistic', label: 'Sales', value: '+12,234', trend: 'down', description: '-19% from last month' }
            ]
        },
        { type: 'separator', className: 'my-6' },
        { 
             type: 'data-table',
             caption: 'Recent Transactions',
             columns: [
                 { header: 'ID', accessorKey: 'id', width: '80px' },
                 { header: 'Amount', accessorKey: 'amount' },
                 { header: 'Status', accessorKey: 'status' }
             ],
             data: [
                 { id: 1, amount: '$350.00', status: 'Paid' },
                 { id: 2, amount: '$120.50', status: 'Processing' },
                 { id: 3, amount: '$850.00', status: 'Paid' }
             ]
        }
    ]
  } as any,
};
