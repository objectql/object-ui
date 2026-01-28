import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Schema/Overlay/Dialog',
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
    type: 'dialog',
    title: 'Schema/Feedback/Edit profile',
    description: 'Make changes to your profile here. Click save when you\'re done.',
    trigger: [
        { type: 'button', props: { variant: 'outline' }, children: [{type:'text', content: 'Edit Profile'}] }
    ],
    content: [
        { 
            type: 'div', 
            className: 'grid gap-4 py-4',
            children: [
                { type: 'input', label: 'Name', defaultValue: 'Pedro Duarte', wrapperClass: 'grid grid-cols-4 items-center gap-4' },
                { type: 'input', label: 'Username', defaultValue: '@peduarte', wrapperClass: 'grid grid-cols-4 items-center gap-4' }
            ]
        }
    ],
    footer: [
        { type: 'button', children: [{type: 'text', content: 'Save changes'}] }
    ]
  } as any,
};
