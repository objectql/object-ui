import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Primitives/Navigation/Sidebar',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties
  },
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to minimize nesting
const sidebarMenu = (items: { label: string, icon?: string, active?: boolean }[]) => ({
  type: 'sidebar-menu',
  body: items.map(item => ({
    type: 'sidebar-menu-item',
    body: [
      {
        type: 'sidebar-menu-button',
        active: item.active,
        tooltip: item.label,
        body: [
          item.icon ? { type: 'icon', name: item.icon } : null,
          { type: 'text', content: item.label }
        ]
      }
    ]
  }))
});

export const DefaultSidebar: Story = {
  args: {
    type: 'sidebar-provider',
    defaultOpen: true,
    style: { height: '600px', border: '1px solid #e2e8f0' }, // Constrain height for storybook
    body: [
      {
        type: 'sidebar',
        collapsible: 'icon',
        body: [
          {
            type: 'sidebar-header',
            body: [
               { 
                 type: 'sidebar-menu',
                 body: [{
                   type: 'sidebar-menu-item',
                   body: [{
                     type: 'sidebar-menu-button',
                     size: 'lg',
                     body: [
                       { 
                         type: 'div', 
                         className: 'flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground',
                         children: [{ type: 'icon', name: 'flower-2', className: 'size-4' }] 
                       },
                       {
                         type: 'div',
                         className: 'grid flex-1 text-left text-sm leading-tight',
                         children: [
                            { type: 'span', className: 'truncate font-semibold', children: [{ type: 'text', content: 'Acme Inc' }] },
                            { type: 'span', className: 'truncate text-xs', children: [{ type: 'text', content: 'Enterprise' }] }
                         ]
                       }
                     ]
                   }]
                 }]
               }
            ]
          },
          {
            type: 'sidebar-content',
            body: [
              {
                type: 'sidebar-group',
                label: 'Platform',
                body: [
                    sidebarMenu([
                        { label: 'Playground', icon: 'terminal', active: true },
                        { label: 'Models', icon: 'bot' },
                        { label: 'Documentation', icon: 'book-open' },
                        { label: 'Settings', icon: 'settings-2' }
                    ])
                ]
              },
              {
                type: 'sidebar-group',
                label: 'Projects',
                body: [
                    sidebarMenu([
                        { label: 'Design Engineering', icon: 'frame' },
                        { label: 'Sales & Marketing', icon: 'pie-chart' },
                        { label: 'Travel', icon: 'map' }
                    ])
                ]
              }
            ]
          },
          {
            type: 'sidebar-footer',
            body: [
               sidebarMenu([
                   { label: 'User Account', icon: 'user' }
               ])
            ]
          }
        ]
      },
      {
        type: 'sidebar-inset',
        body: [
          {
            type: 'header-bar',
            crumbs: [
                { label: 'Building Your Application', href: '#' },
                { label: 'Data Fetching' }
            ]
          },
          {
            type: 'div',
            className: 'flex flex-1 flex-col gap-4 p-4 pt-0',
            children: [
                {
                    type: 'div',
                    className: 'grid auto-rows-min gap-4 md:grid-cols-3',
                    children: [
                        { type: 'div', className: 'aspect-video rounded-xl bg-muted/50' },
                        { type: 'div', className: 'aspect-video rounded-xl bg-muted/50' },
                        { type: 'div', className: 'aspect-video rounded-xl bg-muted/50' }
                    ]
                },
                { type: 'div', className: 'min-h-[100vh] flex-1 rounded-xl bg-muted/50' }
            ]
          }
        ]
      }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};
