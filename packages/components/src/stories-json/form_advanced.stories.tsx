import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Forms/Advanced',
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

export const RadioGroup: Story = {
  render: renderStory,
  args: {
    type: 'radio-group',
    defaultValue: 'option-one',
    id: 'r1',
    options: [
        { label: 'Option One', value: 'option-one' },
        { label: 'Option Two', value: 'option-two' },
        { label: 'Option Three', value: 'option-three' }
    ]
  } as any,
};

export const Slider: Story = {
  render: renderStory,
  args: {
    type: 'slider',
    defaultValue: [33],
    max: 100,
    step: 1,
    className: 'w-[300px]'
  } as any,
};

export const InputOTP: Story = {
  render: renderStory,
  args: {
    type: 'input-otp',
    maxLength: 6,
    value: "123"
  } as any,
};

export const Combobox: Story = {
  render: renderStory,
  args: {
    type: 'combobox',
    placeholder: 'Select framework...',
    className: 'w-[300px]',
    options: [
        { label: 'Next.js', value: 'next.js' },
        { label: 'SvelteKit', value: 'sveltekit' },
        { label: 'Nuxt.js', value: 'nuxt.js' },
        { label: 'Remix', value: 'remix' },
        { label: 'Astro', value: 'astro' }
    ]
  } as any,
};

export const Command: Story = {
  render: renderStory,
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
};

export const FilterBuilder: Story = {
  render: renderStory,
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
};
