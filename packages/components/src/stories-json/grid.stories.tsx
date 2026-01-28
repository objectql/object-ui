import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Layout/Grid',
  component: SchemaRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } }
  }
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Grid: Story = {
  render: renderStory,
  args: {
    type: 'grid',
    props: {
      cols: 2,
      gap: 4
    },
    children: [
        { type: 'card', className: 'p-4 bg-gray-100', children: [{type:'text', content: 'Column 1'}] },
        { type: 'card', className: 'p-4 bg-gray-100', children: [{type:'text', content: 'Column 2'}] },
        { type: 'card', className: 'p-4 bg-gray-100', children: [{type:'text', content: 'Column 3'}] },
        { type: 'card', className: 'p-4 bg-gray-100', children: [{type:'text', content: 'Column 4'}] }
    ]
  } as any,
};

export const Responsive: Story = {
    render: renderStory,
    args: {
      type: 'grid',
      props: {
        cols: {
            base: 1,
            md: 2,
            lg: 4
        },
        gap: 4
      },
      children: [
          { type: 'card', className: 'p-4 bg-red-100', children: [{type:'text', content: '1'}] },
          { type: 'card', className: 'p-4 bg-blue-100', children: [{type:'text', content: '2'}] },
          { type: 'card', className: 'p-4 bg-green-100', children: [{type:'text', content: '3'}] },
          { type: 'card', className: 'p-4 bg-yellow-100', children: [{type:'text', content: '4'}] }
      ]
    } as any,
  };
