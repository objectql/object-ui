/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
// `SidebarSchema` types the one entry point the registry actually maps to a
// schema (`'sidebar'` — see `@object-ui/types`' registry map). The other ten
// entry points below are sidebar PARTS, which have no schema type of their own;
// they take `BaseSchema`, the type every registered node satisfies. Using
// `SidebarSchema` for them would assert `type: 'sidebar'` on a node whose type
// is `'sidebar-header'` (objectui#4353).
import type { SidebarSchema, BaseSchema } from '@object-ui/types';
import { useDisplayLocale } from '@object-ui/i18n';
// Aliased on import, following PR #4169's convention: this repo has its OWN
// `resolveKeyedI18nLabel` over a DIFFERENT vocabulary, and neither resolver
// accepts the other's shape. `schema.label` is the spec's INLINE locale map —
// see `BaseSchema.label` (objectui#4580).
import { resolveI18nLabel as resolveInlineI18nLabel } from '@objectstack/spec/ui';
import { renderChildren } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';
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
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
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
    }
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
    }
  }
);

ComponentRegistry.register('sidebar-header',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarHeader {...props}>{renderChildren(schema.body)}</SidebarHeader>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Header'
  }
);

ComponentRegistry.register('sidebar-content',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarContent {...props}>{renderChildren(schema.body)}</SidebarContent>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Content'
  }
);

ComponentRegistry.register('sidebar-group',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => {
    // Read-time resolution against the display locale (objectui#4580 revised
    // Q1-A). `BaseSchema.label` accepts `string | I18nLabel`; rendering the map
    // straight into a text node THREW "Objects are not valid as a React child".
    // The body became a block only to host this hook — the registry renders its
    // entries with `React.createElement` (`SchemaRenderer.tsx:621`), so hooks
    // are legal here, as `elements.tsx`'s own `useDisplayLocale()` already relies on.
    const locale = useDisplayLocale();
    return (
      <SidebarGroup {...props}>
        {schema.label && (
          <SidebarGroupLabel>{resolveInlineI18nLabel(schema.label, locale)}</SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          {renderChildren(schema.body)}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  },
  {
    namespace: 'ui',
    label: 'Sidebar Group',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' }
    ],
    defaultProps: {
      label: 'Menu'
    }
  }
);

ComponentRegistry.register('sidebar-menu',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarMenu {...props}>{renderChildren(schema.body)}</SidebarMenu>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Menu'
  }
);

ComponentRegistry.register('sidebar-menu-item',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarMenuItem {...props}>{renderChildren(schema.body)}</SidebarMenuItem>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Menu Item'
  }
);

ComponentRegistry.register('sidebar-menu-button',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => {
    // `style` forwarded by name (the objectui#4435 route); everything else goes
    // through the form-control DOM declaration. This is the only `sidebar-*`
    // registration in this file that objectui#5632's group covers — the
    // container ones render `<div>`s and belong to `BARE_SPREAD`, which is a
    // different mechanism group and a different card.
    const { style, ...buttonProps } = props;

    return (
      <SidebarMenuButton
        isActive={schema.active}
        {...toFormControlDomProps(buttonProps)}
        style={style}
      >
        {renderChildren(schema.body)}
      </SidebarMenuButton>
    );
  },
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
    }
  }
);

ComponentRegistry.register('sidebar-footer',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarFooter {...props}>{renderChildren(schema.body)}</SidebarFooter>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Footer'
  }
);

ComponentRegistry.register('sidebar-inset',
  ({ schema, ...props }: { schema: BaseSchema; [key: string]: any }) => (
    <SidebarInset {...props}>{renderChildren(schema.body)}</SidebarInset>
  ),
  { 
    namespace: 'ui',
    label: 'Sidebar Inset'
  }
);

ComponentRegistry.register('sidebar-trigger',
  ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <SidebarTrigger className={className} {...props} />
  ),
  {
    namespace: 'ui',
    label: 'Sidebar Trigger',
    inputs: [{ name: 'className', type: 'string', label: 'CSS Class' }]
  }
);
