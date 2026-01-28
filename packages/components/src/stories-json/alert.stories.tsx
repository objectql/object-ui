import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Data Display/Alert',
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
    type: 'alert',
    title: 'Heads up!',
    description: 'You can add components to your app using the cli.',
    className: 'w-[400px]'
  } as any,
};

export const Destructive: Story = {
  render: renderStory,
  args: {
    type: 'alert',
    variant: 'destructive',
    title: 'Error',
    description: 'Your session has expired. Please log in again.',
    className: 'w-[400px]'
  } as any,
};
