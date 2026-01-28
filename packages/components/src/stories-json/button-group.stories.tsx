import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Actions/Button Group',
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
    type: 'button-group',
    variant: 'outline',
    buttons: [
        { label: 'Years' },
        { label: 'Months' },
        { label: 'Days' }
    ]
  } as any,
};

export const Secondary: Story = {
  render: renderStory,
  args: {
    type: 'button-group',
    variant: 'secondary',
    buttons: [
        { label: 'Save' },
        { label: 'Cancel' }
    ]
  } as any,
};
