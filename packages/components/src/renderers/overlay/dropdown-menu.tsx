/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { DropdownMenuSchema } from '@object-ui/types';
import { useDisplayLocale } from '@object-ui/i18n';
// Aliased on import, following PR #4169's convention: this repo has its OWN
// `resolveKeyedI18nLabel` over a DIFFERENT vocabulary, and neither resolver
// accepts the other's shape. `schema.label` is the spec's INLINE locale map —
// see `BaseSchema.label` (objectui#4580).
import { resolveI18nLabel as resolveInlineI18nLabel } from '@objectstack/spec/ui';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '../../ui';
import { renderChildren } from '../../lib/utils';

// Helper for recursive menu items
const renderMenuItems = (items: any[]) => {
  if (!items) return null;
  return items.map((item: any, i: number) => {
    if (item.type === 'separator') return <DropdownMenuSeparator key={i} />;
    if (item.type === 'label') return <DropdownMenuLabel key={i}>{item.label}</DropdownMenuLabel>;
    if (item.children) {
        return (
            <DropdownMenuSub key={i}>
                <DropdownMenuSubTrigger inset={item.inset}>
                    {item.icon && <span className="mr-2">{item.icon}</span>}
                    {item.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    {renderMenuItems(item.children)}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        )
    }
    
    return (
      <DropdownMenuItem key={i} disabled={item.disabled} inset={item.inset} onSelect={item.onSelect}>
        {item.icon && <span className="mr-2">{item.icon}</span>}
        {item.label}
        {item.shortcut && <span className="ml-auto text-xs tracking-widest opacity-60">{item.shortcut}</span>}
      </DropdownMenuItem>
    );
  });
};

ComponentRegistry.register('dropdown-menu', 
  ({ schema, className, ...props }: { schema: DropdownMenuSchema; className?: string; [key: string]: any }) => {
    // Read-time resolution against the display locale (objectui#4580 revised
    // Q1-A). `BaseSchema.label` accepts `string | I18nLabel`; rendering the map
    // straight into a text node THREW "Objects are not valid as a React child"
    // — observable only with the menu OPEN, since Radix mounts
    // `DropdownMenuContent` lazily. The body became a block only to host this hook.
    const locale = useDisplayLocale();
    return (
      <DropdownMenu modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
        <DropdownMenuTrigger asChild>
           {renderChildren(schema.trigger)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={schema.align} side={schema.side} className={className}>
          {schema.label && (
            <DropdownMenuLabel>{resolveInlineI18nLabel(schema.label, locale)}</DropdownMenuLabel>
          )}
          {schema.label && <DropdownMenuSeparator />}
          {renderMenuItems(schema.items)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
  {
    namespace: 'ui',
    label: 'Dropdown Menu',
    inputs: [
      { name: 'label', type: 'string', label: 'Menu Label' },
       { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'], label: 'Side' },
      { name: 'align', type: 'enum', enum: ['start', 'center', 'end'], label: 'Align' },
       { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger' 
      },
      { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Recursive structure: { type?: "separator"|"label", label, icon, shortcut, disabled, children: [] }'
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Menu', variant: 'outline' }],
      items: [
        { label: 'Item 1' },
        { label: 'Item 2' },
        { type: 'separator' },
        { label: 'Item 3' }
      ],
      align: 'start',
      side: 'bottom'
    }
  }
);
