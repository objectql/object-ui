import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Navigation/Menus',
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

export const DropdownMenu: Story = {
  render: renderStory,
  args: {
    type: 'dropdown-menu',
    trigger: [
        { type: 'button', props: { variant: 'outline' }, children: [{type:'text', content: 'Open Menu'}] }
    ],
    label: 'My Account',
    items: [
        { label: 'Profile', shortcut: '⇧⌘P' },
        { label: 'Billing', shortcut: '⌘B' },
        { label: 'Settings', shortcut: '⌘S' },
        { type: 'separator' },
        { label: 'Team', children: [
            { label: 'Invite users' },
            { label: 'Create team' },
        ]},
        { type: 'separator' },
        { label: 'Log out', shortcut: '⇧⌘Q' }
    ]
  } as any,
};

export const Sheet: Story = {
  render: renderStory,
  args: {
    type: 'sheet',
    trigger: [
        { type: 'button', props: { variant: 'outline' }, children: [{type: 'text', content: 'Open Sheet'}] }
    ],
    title: 'Schema/Navigation/Edit profile',
    description: 'Make changes to your profile here. Click save when you\'re done.',
    side: 'right',
    content: [
         { type: 'div', className: 'grid gap-4 py-4', children: [
             { type: 'input', label: 'Name', defaultValue: 'Pedro Duarte', wrapperClass: 'grid grid-cols-4 items-center gap-4' },
             { type: 'input', label: 'Username', defaultValue: '@peduarte', wrapperClass: 'grid grid-cols-4 items-center gap-4' }
         ]}
    ],
    footer: [
        { type: 'button', children: [{type: 'text', content: 'Save changes'}] }
    ]
  } as any,
};
