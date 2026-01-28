import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Complex/Carousel',
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
    type: 'carousel',
    className: 'w-full max-w-xs',
    items: [
        { type: 'card', className: 'p-6 flex aspect-square items-center justify-center', children: [{type:'text', className:'text-4xl font-semibold', content: '1'}] },
        { type: 'card', className: 'p-6 flex aspect-square items-center justify-center', children: [{type:'text', className:'text-4xl font-semibold', content: '2'}] },
        { type: 'card', className: 'p-6 flex aspect-square items-center justify-center', children: [{type:'text', className:'text-4xl font-semibold', content: '3'}] },
        { type: 'card', className: 'p-6 flex aspect-square items-center justify-center', children: [{type:'text', className:'text-4xl font-semibold', content: '4'}] },
        { type: 'card', className: 'p-6 flex aspect-square items-center justify-center', children: [{type:'text', className:'text-4xl font-semibold', content: '5'}] }
    ]
  } as any,
};
