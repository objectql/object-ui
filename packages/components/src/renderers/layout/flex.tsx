/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { FlexSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';

ComponentRegistry.register('flex', 
  ({ schema, className, ...props }: { schema: FlexSchema; className?: string; [key: string]: any }) => {
    const direction = schema.direction || 'row';
    const justify = schema.justify || 'start';
    const align = schema.align || 'start';
    // `??`, not `||`: `gap` is a declared `number`, and `0` is a legal value that
    // `||` folds into the default — which left the `gap === 0 && 'gap-0'` branch
    // below permanently unreachable. Sibling `stack.tsx` / `grid.tsx` already read
    // theirs with `??`; this converges the family (objectui#4003).
    const gap = schema.gap ?? 2;
    const wrap = schema.wrap || false;
    
    const flexClass = cn(
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
      gap === 7 && 'gap-4 sm:gap-5 md:gap-7',
      gap === 8 && 'gap-4 sm:gap-6 md:gap-8',
      // Wrap
      wrap && 'flex-wrap',
      className
    );

    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...flexProps 
    } = props;

    return (
      <div 
        className={flexClass} 
        {...flexProps}
        // Apply designer props
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
      >
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Flex Layout',
    inputs: [
      { 
        name: 'direction', 
        type: 'enum', 
        enum: ['row', 'col', 'row-reverse', 'col-reverse'],
        label: 'Direction',
        defaultValue: 'row'
      },
      { 
        name: 'justify', 
        type: 'enum', 
        enum: ['start', 'end', 'center', 'between', 'around', 'evenly'],
        label: 'Justify Content',
        defaultValue: 'start'
      },
      { 
        name: 'align', 
        type: 'enum', 
        enum: ['start', 'end', 'center', 'baseline', 'stretch'],
        label: 'Align Items',
        defaultValue: 'start'
      },
      { 
        name: 'gap', 
        type: 'number', 
        label: 'Gap', 
        defaultValue: 2,
        description: 'Gap between items (0-8)'
      },
      { 
        name: 'wrap', 
        type: 'boolean', 
        label: 'Wrap', 
        defaultValue: false,
        description: 'Allow flex items to wrap'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      direction: 'row',
      justify: 'start',
      align: 'center',
      gap: 2,
      wrap: false,
      children: [
        { type: 'button', label: 'Button 1' },
        { type: 'button', label: 'Button 2' },
        { type: 'button', label: 'Button 3' }
      ]
    }
  }
);
