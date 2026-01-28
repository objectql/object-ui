import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Layout/Tabs',
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
    type: 'tabs',
    defaultValue: 'account',
    className: 'w-[400px]',
    items: [
        { 
            label: 'Account', 
            value: 'account', 
            body: [
                { type: 'card', title: 'Account', description: "Make changes to your account here.", children: [
                    { type: 'input', label: 'Name', defaultValue: 'Pedro Duarte', wrapperClass: 'mb-4' },
                    { type: 'input', label: 'Username', defaultValue: '@peduarte' },
                    { type: 'button', children: [{type:'text', content: 'Save changes'}], className: 'mt-4' }
                ]}
            ] 
        },
        { 
            label: 'Password', 
            value: 'password', 
            body: [
                { type: 'card', title: 'Password', description: "Change your password here.", children: [
                    { type: 'input', label: 'Current Password', inputType: 'password', wrapperClass: 'mb-4' },
                    { type: 'input', label: 'New Password', inputType: 'password' },
                    { type: 'button', children: [{type:'text', content: 'Save password'}], className: 'mt-4' }
                ]}
            ] 
        }
    ]
  } as any,
};
