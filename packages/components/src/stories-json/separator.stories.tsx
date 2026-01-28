import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Layout/Separator',
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

export const Separator: Story = {
  render: renderStory,
  args: {
    type: 'div',
    className: 'text-sm font-medium',
    children: [
        { type: 'text', content: 'Radix Primitives' },
        { type: 'separator', className: 'my-4' },
        { 
            type: 'div', 
            className: 'flex h-5 items-center space-x-4 text-sm',
            children: [
                { type: 'text', content: 'Blog' },
                { type: 'separator', orientation: 'vertical' },
                { type: 'text', content: 'Docs' },
                { type: 'separator', orientation: 'vertical' },
                { type: 'text', content: 'Source' }
            ]
        }
    ]
  } as any,
};
