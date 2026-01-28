import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Form/Controls',
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

export const Checkbox: Story = {
  render: renderStory,
  args: {
    type: 'checkbox',
    label: 'Accept terms and conditions',
    id: 'terms1'
  } as any,
};

export const Switch: Story = {
  render: renderStory,
  args: {
    type: 'switch',
    label: 'Airplane Mode',
    id: 'airplane-mode'
  } as any,
};
