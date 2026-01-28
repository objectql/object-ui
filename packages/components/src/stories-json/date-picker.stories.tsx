import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Form/Date Picker',
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
    type: 'date-picker',
    label: 'Date of birth',
    placeholder: 'Pick a date',
    description: 'Your date of birth is used to calculate your age.'
  } as any,
};
