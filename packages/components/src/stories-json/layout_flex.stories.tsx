import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Primitives/Layout/Flex',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties will be passed as args
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FlexRow: Story = {
  args: {
    type: 'flex',
    direction: 'row',
    gap: 4,
    align: 'center',
    className: 'p-4 border rounded-lg bg-slate-50',
    children: [
      { 
        type: 'badge', 
        variant: 'default',
        content: 'Item 1' 
      },
      { 
        type: 'badge', 
        variant: 'secondary',
        content: 'Item 2' 
      },
      { 
        type: 'badge', 
        variant: 'outline',
        content: 'Item 3' 
      }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const FlexColumn: Story = {
  args: {
    type: 'flex',
    direction: 'col',
    gap: 2,
    className: 'p-4 border rounded-lg max-w-xs',
    children: [
      { 
        type: 'alert', 
        variant: 'default',
        children: [{ type: 'text', content: 'Alert 1' }]
      },
      { 
        type: 'alert', 
        variant: 'destructive',
         children: [{ type: 'text', content: 'Alert 2' }]
      }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const StackDefault: Story = {
  args: {
    type: 'stack',
    gap: 4,
    className: 'p-6 border rounded-md',
    children: [
      { 
        type: 'text', 
        content: 'Stack is essentially a Flex Column', 
        className: 'font-semibold' 
      },
      { 
        type: 'input', 
        placeholder: 'First Name' 
      },
      { 
        type: 'input', 
        placeholder: 'Last Name' 
      },
      { 
        type: 'button', 
        content: 'Submit',
        className: 'w-full'
      }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const FlexWrap: Story = {
  args: {
    type: 'flex',
    wrap: true,
    gap: 2,
    className: 'w-64 p-4 border border-dashed',
    children: Array.from({ length: 12 }).map((_, i) => ({
      type: 'badge',
      content: `Tag ${i + 1}`
    }))
  },
  render: (args) => <SchemaRenderer schema={args} />
};
