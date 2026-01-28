import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta: Meta = {
  title: 'Form/Inputs',
  component: SchemaRenderer,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Slider: Story = {
  args: {
    type: 'slider',
    defaultValue: [50],
    max: 100,
    min: 0,
    step: 1,
    className: 'w-[300px]'
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const InputOTP: Story = {
    args: {
        type: 'input-otp',
        maxLength: 6,
        className: 'gap-2'
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const Command: Story = {
    args: {
        type: 'command',
        placeholder: 'Search documentation...',
        className: 'rounded-lg border shadow-md w-[450px]',
        groups: [
            {
                heading: 'Suggestions',
                items: [
                   { value: 'cal', label: 'Calendar' },
                   { value: 'em', label: 'Search Emoji' },
                   { value: 'calc', label: 'Calculator' }
                ]
            },
            {
                heading: 'Settings',
                items: [
                    { value: 'prof', label: 'Profile' },
                    { value: 'bill', label: 'Billing' },
                    { value: 'set', label: 'Settings' }
                ]
            }
        ]
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const FilterBuilder: Story = {
    args: {
      type: 'filter-builder',
      name: 'user_filters',
      label: 'User Filters',
      fields: [
        { value: 'name', label: 'Name', type: 'text' },
        { value: 'email', label: 'Email', type: 'text' },
        { value: 'age', label: 'Age', type: 'number' },
        { value: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
      ],
      value: {
        id: 'root',
        logic: 'and',
        conditions: [
            { field: 'age', operator: 'gt', value: 18 }
        ]
      }
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};
