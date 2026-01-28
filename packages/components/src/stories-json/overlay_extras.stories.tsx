import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Primitives/Overlay/Extras',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AlertDialogExample: Story = {
  args: {
    type: 'alert-dialog',
    title: 'Schema/Feedback/Delete Account',
    description: 'Are you sure you want to delete your account? This action cannot be undone.',
    actionText: 'Yes, Delete',
    cancelText: 'Cancel',
    trigger: [
        { type: 'button', content: 'Delete Account', variant: 'destructive' }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const ContextMenuExample: Story = {
  args: {
    type: 'context-menu',
    triggerClassName: 'flex h-[150px] w-full items-center justify-center rounded-md border border-dashed text-sm',
    trigger: [
        { type: 'text', content: 'Right click here' }
    ],
    items: [
        { label: 'Back', shortcut: '⌘[' },
        { label: 'Forward', shortcut: '⌘]', disabled: true },
        { label: 'Reload', shortcut: '⌘R' },
        { type: 'separator' },
        { label: 'Save As...', shortcut: '⇧⌘S' },
        { label: 'Print...', shortcut: '⌘P' }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const DrawerExample: Story = {
    args: {
      type: 'drawer',
      title: 'Schema/Feedback/Monthly Goal',
      description: 'Set your daily activity goal.',
      trigger: [
          { type: 'button', content: 'Open Drawer', variant: 'outline' }
      ],
      content: [
          { 
              type: 'div', 
              className: 'p-4 pb-0 items-center justify-center flex',
              children: [
                  { 
                      type: 'div', 
                      className: 'text-4xl font-bold p-10',
                      children: [{ type: 'text', content: '400/500' }] 
                  }
              ] 
          }
      ],
      footer: [
          { type: 'button', content: 'Submit', className: 'w-full' },
          { type: 'button', content: 'Cancel', variant: 'outline', className: 'w-full' }
      ]
    },
    render: (args) => <SchemaRenderer schema={args} />
  };

export const MenubarExample: Story = {
    args: {
      type: 'menubar',
      menus: [
          {
              label: 'File',
              items: [
                  { label: 'New Tab', shortcut: '⌘T' },
                  { label: 'New Window', shortcut: '⌘N' },
                  { separator: true },
                  { label: 'Share', children: [
                      { label: 'Email link' },
                      { label: 'Messages' }
                  ]},
                  { separator: true },
                  { label: 'Print' }
              ]
          },
          {
              label: 'Edit',
              items: [
                  { label: 'Undo', shortcut: '⌘Z' },
                  { label: 'Redo', shortcut: '⇧⌘Z' }
              ]
          },
          {
              label: 'View',
              items: [
                  { label: 'Always Show Bookmarks Bar' },
                  { label: 'Always Show Full URLs' }
              ]
          }
      ]
    },
    render: (args) => <SchemaRenderer schema={args} />
  };
