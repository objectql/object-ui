/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { DrawerSchema } from '@object-ui/types';
import { 
  Drawer, 
  DrawerTrigger, 
  DrawerContent, 
  DrawerHeader, 
  DrawerFooter, 
  DrawerTitle, 
  DrawerDescription,
  DrawerClose
} from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('drawer', 
  ({ schema, className, ...props }: { schema: DrawerSchema; className?: string; [key: string]: any }) => (
    <Drawer shouldScaleBackground={schema.shouldScaleBackground} defaultOpen={schema.defaultOpen} {...props}>
      <DrawerTrigger asChild>
        {renderChildren(schema.trigger)}
      </DrawerTrigger>
      <DrawerContent className={className}>
        <DrawerHeader>
          {schema.title && <DrawerTitle>{schema.title}</DrawerTitle>}
          {schema.description && <DrawerDescription>{schema.description}</DrawerDescription>}
        </DrawerHeader>
        {renderChildren(schema.content)}
        {schema.footer && (
          <DrawerFooter>
             {renderChildren(schema.footer)}
             {schema.showClose && <DrawerClose asChild><button type="button">Close</button></DrawerClose>} 
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  ),
  {
    namespace: 'ui',
    label: 'Drawer',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
       { name: 'shouldScaleBackground', type: 'boolean', label: 'Scale Background' },
        { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
       { name: 'showClose', type: 'boolean', label: 'Show Close Button in Footer' },
      { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger' 
      },
      { 
        name: 'content', 
        type: 'slot', 
        label: 'Content' 
      },
       { 
        name: 'footer', 
        type: 'slot', 
        label: 'Footer' 
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      title: 'Drawer Title',
      description: 'Drawer description',
      trigger: [{ type: 'button', label: 'Open Drawer' }],
      content: [{ type: 'text', content: 'Drawer content goes here' }]
    }
  }
);
