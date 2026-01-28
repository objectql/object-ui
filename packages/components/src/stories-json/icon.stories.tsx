import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Basic/Icon',
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
    type: 'icon',
    name: 'calendar',
    className: 'h-10 w-10 text-primary'
  } as any,
};

export const Colored: Story = {
  render: renderStory,
  args: {
    type: 'icon',
    name: 'heart',
    className: 'h-10 w-10 text-red-500 fill-red-500'
  } as any,
};
