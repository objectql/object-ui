import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Form/Input',
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
    type: 'input',
    label: 'Email Address',
    placeholder: 'Enter your email',
    inputType: 'email',
    description: 'We will never share your email.',
    wrapperClass: 'w-[300px]'
  } as any,
};

export const WithError: Story = {
  render: renderStory,
  args: {
    type: 'input',
    label: 'Username',
    placeholder: 'jdoe',
    value: 'invalid name',
    error: 'Username is already taken',
    wrapperClass: 'w-[300px]'
  } as any,
};

export const Textarea: Story = {
  render: renderStory,
  args: {
    type: 'textarea',
    label: 'Bio',
    placeholder: 'Tell us a little bit about yourself',
    wrapperClass: 'w-[300px]'
  } as any,
};
