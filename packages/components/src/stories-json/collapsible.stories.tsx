import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Disclosure/Collapsible',
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
    type: 'collapsible',
    className: 'w-[350px] space-y-2',
    trigger: [
        { 
            type: 'div', 
            className: 'flex items-center justify-between space-x-4 px-4 py-2 hover:bg-muted/50 rounded-md cursor-pointer',
            children: [
                { type: 'text', content: '@peduarte starred 3 repositories' },
                { type: 'icon', name: 'chevrons-up-down', className: 'h-4 w-4' }
            ]
        }
    ],
    content: [
         { type: 'div', className: 'rounded-md border p-2 mb-2', children: [{type:'text', content: '@radix-ui/primitives'}] },
         { type: 'div', className: 'rounded-md border p-2', children: [{type:'text', content: '@radix-ui/react'}] }
    ]
  } as any,
};
