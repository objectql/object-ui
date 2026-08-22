/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { StackSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

// Stack is essentially a Flex container that defaults to column direction
// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const StackRenderer = forwardRef<HTMLDivElement, { schema: StackSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: StackSchema; className?: string; [key: string]: any }, ref) => {
    // Default to column for Stack
    const direction = schema.direction || 'col';
    const justify = schema.justify || 'start';
    const align = schema.align || 'stretch'; // Stack items usually stretch
    // `gap` ONLY. `stack.tsx` also read an undeclared `spacing` here, through an
    // `as any` that existed to get past the type system saying it wasn't there —
    // `StackSchema` extends `FlexSchema`, whose only spacing key is `gap`, and the
    // registration below has always listed `gap` alone. That second reader made
    // `spacing` a de-facto contract nothing declared: 135 catalog nodes across 39
    // files were authored with it, rendered correctly, and taught every copying
    // author (and every few-shot retrieval over these examples) a key the types do
    // not have. Re-typing such a node to `flex` — semantically one `direction`
    // away — would have dropped the spacing silently, because `flex.tsx` never
    // read `spacing`. Fixed at the PRODUCER (AGENTS.md #0.1): the 135 nodes now
    // author `gap`, and the alias is gone rather than legalised into the schema,
    // where it would only have been a second name for `gap` (objectui#4890).
    const gap = schema.gap ?? 2;
    const wrap = schema.wrap || false;
    
    const stackClass = cn(
      'flex',
      // Direction
      direction === 'row' && 'flex-row',
      direction === 'col' && 'flex-col',
      direction === 'row-reverse' && 'flex-row-reverse',
      direction === 'col-reverse' && 'flex-col-reverse',
      // Justify content
      justify === 'start' && 'justify-start',
      justify === 'end' && 'justify-end',
      justify === 'center' && 'justify-center',
      justify === 'between' && 'justify-between',
      justify === 'around' && 'justify-around',
      justify === 'evenly' && 'justify-evenly',
      // Align items
      align === 'start' && 'items-start',
      align === 'end' && 'items-end',
      align === 'center' && 'items-center',
      align === 'baseline' && 'items-baseline',
      align === 'stretch' && 'items-stretch',
      // Gap - Mobile-first responsive
      gap === 0 && 'gap-0',
      gap === 1 && 'gap-1',
      gap === 2 && 'gap-1.5 sm:gap-2',
      gap === 3 && 'gap-2 sm:gap-3',
      gap === 4 && 'gap-2 sm:gap-3 md:gap-4',
      gap === 5 && 'gap-3 sm:gap-4 md:gap-5',
      gap === 6 && 'gap-3 sm:gap-4 md:gap-6',
      gap === 8 && 'gap-4 sm:gap-6 md:gap-8',
      gap === 10 && 'gap-5 sm:gap-7 md:gap-10',
      // Wrap
      wrap && 'flex-wrap',
      className
    );

    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...stackProps 
    } = props;

    return (
      <div 
        ref={ref}
        className={stackClass} 
        {...stackProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  }
);

ComponentRegistry.register('stack', 
  StackRenderer,
  {
    namespace: 'ui',
    label: 'Stack',
    inputs: [
      { 
        name: 'direction', 
        type: 'enum', 
        label: 'Direction', 
        enum: ['col', 'row', 'col-reverse', 'row-reverse'], 
        defaultValue: 'col' 
      },
      { 
        name: 'gap', 
        type: 'number', 
        label: 'Gap', 
        defaultValue: 2 
      },
      { 
        name: 'align', 
        type: 'enum', 
        label: 'Align Items',
        enum: ['start', 'end', 'center', 'stretch', 'baseline'],
        defaultValue: 'stretch'
      },
      { 
        name: 'justify', 
        type: 'enum', 
        label: 'Justify Content',
        enum: ['start', 'end', 'center', 'between', 'around', 'evenly'],
        defaultValue: 'start'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      direction: 'col',
      gap: 2,
      align: 'stretch',
      children: []
    },
    isContainer: true,
    resizable: true,
    resizeConstraints: {
        width: true,
        height: true,
        minWidth: 100,
        minHeight: 50
    }
  }
);
