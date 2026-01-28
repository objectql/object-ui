import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Feedback/Others',
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

export const Progress: Story = {
  render: renderStory,
  args: {
    type: 'progress',
    value: 60,
    className: 'w-[300px]'
  } as any,
};

export const Skeleton: Story = {
  render: renderStory,
  args: {
    type: 'div',
    className: 'flex items-center space-x-4',
    children: [
        { type: 'skeleton', className: 'h-12 w-12 rounded-full' },
        { 
            type: 'div', 
            className: 'space-y-2',
            children: [
                { type: 'skeleton', className: 'h-4 w-[250px]' },
                { type: 'skeleton', className: 'h-4 w-[200px]' },
            ]
        }
    ]
  } as any,
};
