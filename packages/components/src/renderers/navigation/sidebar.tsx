/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { SidebarSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset
} from '../../ui';

ComponentRegistry.register('sidebar-provider', 
  ({ schema, ...props }) => (
    <SidebarProvider {...props}>{renderChildren(schema.body)}</SidebarProvider>
  ),
  {
    namespace: 'ui',
    label: 'Sidebar Provider',
    inputs: [
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open', defaultValue: true }
    ],
    defaultProps: {
      defaultOpen: true
    },
    defaultChildren: [
      { type: 'sidebar' },
      { type: 'sidebar-inset' }
    ]
  }
);

ComponentRegistry.register('sidebar', 
  ({ schema, ...props }: { schema: SidebarSchema; [key: string]: any }) => (
    <Sidebar {...props}>{renderChildren(schema.body)}</Sidebar>
  ),
  {
    namespace: 'ui',
    label: 'Sidebar',
    inputs: [
      { name: 'collapsible', type: 'enum', enum: ['offcanvas', 'icon', 'none'], defaultValue: 'icon', label: 'Collapsible' },
      { name: 'side', type: 'enum', enum: ['left', 'right'], defaultValue: 'left', label: 'Side' },
      { name: 'variant', type: 'enum', enum: ['sidebar', 'floating', 'inset'], defaultValue: 'sidebar', label: 'Variant' }
    ],
    defaultProps: {
      collapsible: 'icon',
      side: 'left',
      variant: 'sidebar'
    },
    defaultChildren: [
      { type: 'sidebar-header' },
      { type: 'sidebar-content' },
      { type: 'sidebar-footer' }
    ]
  }
);

ComponentRegistry.register('sidebar-header', 
  ({ schema, ...props }) => (
    <SidebarHeader {...props}>{renderChildren(schema.body)}</SidebarHeader>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Header',
    defaultChildren: [
      { type: 'text', content: 'Sidebar Header' }
    ]
  }
);

ComponentRegistry.register('sidebar-content', 
  ({ schema, ...props }) => (
    <SidebarContent {...props}>{renderChildren(schema.body)}</SidebarContent>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Content',
    defaultChildren: [
      { type: 'sidebar-group' }
    ]
  }
);

ComponentRegistry.register('sidebar-group', 
  ({ schema, ...props }) => (
    <SidebarGroup {...props}>
      {schema.label && <SidebarGroupLabel>{schema.label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        {renderChildren(schema.body)}
      </SidebarGroupContent>
    </SidebarGroup>
  ),
  {
    namespace: 'ui',
    label: 'Sidebar Group',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' }
    ],
    defaultProps: {
      label: 'Menu'
    },
    defaultChildren: [
      { type: 'sidebar-menu' }
    ]
  }
);

ComponentRegistry.register('sidebar-menu', 
  ({ schema, ...props }) => (
    <SidebarMenu {...props}>{renderChildren(schema.body)}</SidebarMenu>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Menu',
    defaultChildren: [
      { type: 'sidebar-menu-item' },
      { type: 'sidebar-menu-item' }
    ]
  }
);

ComponentRegistry.register('sidebar-menu-item', 
  ({ schema, ...props }) => (
    <SidebarMenuItem {...props}>{renderChildren(schema.body)}</SidebarMenuItem>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Menu Item',
    defaultChildren: [
      { type: 'sidebar-menu-button' }
    ]
  }
);

ComponentRegistry.register('sidebar-menu-button', 
  ({ schema, ...props }) => (
    <SidebarMenuButton isActive={schema.active} {...props}>
      {renderChildren(schema.body)}
    </SidebarMenuButton>
  ),
  {
    namespace: 'ui',
    label: 'Sidebar Menu Button',
    inputs: [
      { name: 'active', type: 'boolean', label: 'Active', defaultValue: false },
      { name: 'size', type: 'enum', enum: ['default', 'sm', 'lg'], defaultValue: 'default', label: 'Size' },
      { name: 'tooltip', type: 'string', label: 'Tooltip' }
    ],
    defaultProps: {
      size: 'default'
    },
    defaultChildren: [
      { type: 'text', content: 'Menu Item' }
    ]
  }
);

ComponentRegistry.register('sidebar-footer', 
  ({ schema, ...props }) => (
    <SidebarFooter {...props}>{renderChildren(schema.body)}</SidebarFooter>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Footer',
    defaultChildren: [
      { type: 'text', content: 'Footer' }
    ]
  }
);

ComponentRegistry.register('sidebar-inset', 
  ({ schema, ...props }) => (
    <SidebarInset {...props}>{renderChildren(schema.body)}</SidebarInset>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Inset',
    defaultChildren: [
      { type: 'div', className: 'p-4', body: [{ type: 'text', content: 'Main content area' }] }
    ]
  }
);

ComponentRegistry.register('sidebar-trigger', 
  ({ className, ...props }) => (
    <SidebarTrigger className={className} {...props} />
  ),
  {
    namespace: 'ui',
    label: 'Sidebar Trigger',
    inputs: [{ name: 'className', type: 'string', label: 'CSS Class' }]
  }
);
