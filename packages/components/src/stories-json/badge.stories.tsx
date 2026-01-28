import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Display/Badge',
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

export const Badge: Story = {
  render: renderStory,
  args: {
    type: 'badge',
    label: 'Badge'
  } as any,
};

export const Secondary: Story = {
  render: renderStory,
  args: {
    type: 'badge',
    label: 'Secondary',
    variant: 'secondary'
  } as any,
};

export const Destructive: Story = {
  render: renderStory,
  args: {
    type: 'badge',
    label: 'Destructive',
    variant: 'destructive'
  } as any,
};

export const Outline: Story = {
  render: renderStory,
  args: {
    type: 'badge',
    label: 'Outline',
    variant: 'outline'
  } as any,
};
