/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { SheetSchema } from '@object-ui/types';
import { 
  Sheet, 
  SheetTrigger, 
  SheetContent, 
  SheetHeader, 
  SheetFooter, 
  SheetTitle, 
  SheetDescription
} from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('sheet', 
  ({ schema, className, ...props }: { schema: SheetSchema; className?: string; [key: string]: any }) => (
    <Sheet modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
      <SheetTrigger asChild>
        {renderChildren(schema.trigger)}
      </SheetTrigger>
      <SheetContent side={schema.side || 'right'} className={className}>
        <SheetHeader>
          {schema.title && <SheetTitle>{schema.title}</SheetTitle>}
          {schema.description && <SheetDescription>{schema.description}</SheetDescription>}
        </SheetHeader>
        {renderChildren(schema.content)}
        {schema.footer && (
          <SheetFooter>
            {renderChildren(schema.footer)}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  ),
  {
    namespace: 'ui',
    label: 'Sheet',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'] },
      { name: 'modal', type: 'boolean' },
       { name: 'defaultOpen', type: 'boolean' },
      { 
        name: 'trigger', 
        type: 'slot', 
      },
      { 
        name: 'content', 
        type: 'slot', 
      },
       { 
        name: 'footer', 
        type: 'slot'      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      title: 'Sheet Title',
      description: 'Sheet description',
      side: 'right',
      modal: true,
      trigger: [{ type: 'button', label: 'Open Sheet' }],
      content: [{ type: 'text', content: 'Sheet content goes here' }]
    }
  }
);
