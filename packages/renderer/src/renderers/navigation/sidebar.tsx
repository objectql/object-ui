import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';
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
} from '@object-ui/ui';

ComponentRegistry.register('sidebar-provider', 
  ({ schema, ...props }) => (
    <SidebarProvider {...props}>{renderChildren(schema.body)}</SidebarProvider>
  ),
  {
    label: 'Sidebar Provider',
    inputs: [
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open', defaultValue: true }
    ]
  }
);

ComponentRegistry.register('sidebar', 
  ({ schema, ...props }) => (
    <Sidebar {...props}>{renderChildren(schema.body)}</Sidebar>
  ),
  {
    label: 'Sidebar',
    inputs: [
      { name: 'collapsible', type: 'enum', enum: ['offcanvas', 'icon', 'none'], defaultValue: 'icon', label: 'Collapsible' },
      { name: 'side', type: 'enum', enum: ['left', 'right'], defaultValue: 'left', label: 'Side' },
      { name: 'variant', type: 'enum', enum: ['sidebar', 'floating', 'inset'], defaultValue: 'sidebar', label: 'Variant' }
    ]
  }
);

ComponentRegistry.register('sidebar-header', 
  ({ schema, ...props }) => (
    <SidebarHeader {...props}>{renderChildren(schema.body)}</SidebarHeader>
  ),
  { label: 'Sidebar Header' }
);

ComponentRegistry.register('sidebar-content', 
  ({ schema, ...props }) => (
    <SidebarContent {...props}>{renderChildren(schema.body)}</SidebarContent>
  ),
  { label: 'Sidebar Content' }
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
    label: 'Sidebar Group',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' }
    ]
  }
);

ComponentRegistry.register('sidebar-menu', 
  ({ schema, ...props }) => (
    <SidebarMenu {...props}>{renderChildren(schema.body)}</SidebarMenu>
  ),
  { label: 'Sidebar Menu' }
);

ComponentRegistry.register('sidebar-menu-item', 
  ({ schema, ...props }) => (
    <SidebarMenuItem {...props}>{renderChildren(schema.body)}</SidebarMenuItem>
  ),
  { label: 'Sidebar Menu Item' }
);

ComponentRegistry.register('sidebar-menu-button', 
  ({ schema, ...props }) => (
    <SidebarMenuButton isActive={schema.active} {...props}>
      {renderChildren(schema.body)}
    </SidebarMenuButton>
  ),
  {
    label: 'Sidebar Menu Button',
    inputs: [
      { name: 'active', type: 'boolean', label: 'Active', defaultValue: false },
      { name: 'size', type: 'enum', enum: ['default', 'sm', 'lg'], defaultValue: 'default', label: 'Size' },
      { name: 'tooltip', type: 'string', label: 'Tooltip' }
    ]
  }
);

ComponentRegistry.register('sidebar-footer', 
  ({ schema, ...props }) => (
    <SidebarFooter {...props}>{renderChildren(schema.body)}</SidebarFooter>
  ),
  { label: 'Sidebar Footer' }
);

ComponentRegistry.register('sidebar-inset', 
  ({ schema, ...props }) => (
    <SidebarInset {...props}>{renderChildren(schema.body)}</SidebarInset>
  ),
  { label: 'Sidebar Inset' }
);

ComponentRegistry.register('sidebar-trigger', 
  ({ className, ...props }) => (
    <SidebarTrigger className={className} {...props} />
  ),
  {
    label: 'Sidebar Trigger',
    inputs: [{ name: 'className', type: 'string', label: 'CSS Class' }]
  }
);
