/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { MenubarSchema } from '@object-ui/types';
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarShortcut } from '../../ui/menubar';

ComponentRegistry.register('menubar', 
  ({ schema, ...props }: { schema: MenubarSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...menubarProps
    } = props;
    
    return (
      <Menubar 
        className={schema.className} 
        {...menubarProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {schema.menus?.map((menu, idx) => (
          <MenubarMenu key={idx}>
            <MenubarTrigger>{menu.label}</MenubarTrigger>
            <MenubarContent>
              {menu.items?.map((item, itemIdx) => (
                item.separator ? (
                  <MenubarSeparator key={itemIdx} />
                ) : item.children ? (
                  <MenubarSub key={itemIdx}>
                    <MenubarSubTrigger>{item.label}</MenubarSubTrigger>
                    <MenubarSubContent>
                      {item.children.map((child, childIdx) =>
                        // A submenu child is itself a `MenuItem` — the same
                        // union as the top-level item, so it can be a divider
                        // too (objectui#6523); narrowing on `child.separator`
                        // is what makes `child.label` below type-check.
                        child.separator ? (
                          <MenubarSeparator key={childIdx} />
                        ) : (
                          <MenubarItem
                            key={childIdx}
                            disabled={child.disabled}
                            // Fires the DECLARED `onClick` (objectui#6346
                            // rider — menubar previously wired no item
                            // handler at all, neither spelling).
                            onSelect={() => child.onClick?.()}
                          >
                            {child.label}
                            {child.shortcut && <MenubarShortcut>{child.shortcut}</MenubarShortcut>}
                          </MenubarItem>
                        )
                      )}
                    </MenubarSubContent>
                  </MenubarSub>
                ) : (
                  <MenubarItem
                    key={itemIdx}
                    disabled={item.disabled}
                    // Fires the DECLARED `onClick` (objectui#6346 rider).
                    onSelect={() => item.onClick?.()}
                  >
                    {item.label}
                    {/* Parity, not new capability (objectui#6523 rider): the
                        declared `shortcut` string already has working
                        runtime in dropdown-menu and context-menu; menubar
                        read it nowhere. */}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                )
              ))}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
    );
  },
  {
    namespace: 'ui',
    label: 'Menubar',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      menus: [
        {
          label: 'File',
          items: [
            { label: 'New' },
            { label: 'Open' },
            { separator: true },
            { label: 'Exit' }
          ]
        }
      ]
    }
  }
);
