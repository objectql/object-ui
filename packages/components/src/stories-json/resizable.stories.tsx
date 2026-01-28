import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Complex/Resizable',
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

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'resizable',
    className: 'max-w-md rounded-lg border',
    minHeight: '200px',
    panels: [
        { 
            defaultSize: 50, 
            content: [
                { type: 'div', className: 'flex h-full items-center justify-center p-6', children: [{type:'text', className:'font-semibold', content:'One'}] }
            ] 
        },
        { 
            defaultSize: 50, 
            content: [
                 { type: 'resizable', direction: 'vertical', children: [], panels: [
                     { defaultSize: 25, content: [{ type: 'div', className: 'flex h-full items-center justify-center p-6', children: [{type:'text', className:'font-semibold', content:'Two'}] }] },
                     { defaultSize: 75, content: [{ type: 'div', className: 'flex h-full items-center justify-center p-6', children: [{type:'text', className:'font-semibold', content:'Three'}] }] }
                 ] }
            ] 
        }
    ]
  } as any,
};
