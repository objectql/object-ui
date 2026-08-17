/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ContainerSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const ContainerRenderer = forwardRef<HTMLDivElement, { schema: ContainerSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: ContainerSchema; className?: string; [key: string]: any }, ref) => {
    const maxWidth = (schema.maxWidth || 'xl') as any;
    // `??`, not `||`: `padding` is a declared `number`, and `0` is a legal value
    // that `||` folds into the default — which left the `padding === 0 && 'p-0'`
    // branch below permanently unreachable, so a container asking for no padding
    // silently rendered `p-2 sm:p-3 md:p-4` (objectui#4003).
    const padding = schema.padding ?? 4;
    const centered = schema.centered !== false; // Default to true
    
    const containerClass = cn(
      // Base container
      'w-full',
      // Max width
      maxWidth === 'sm' && 'max-w-sm',
      maxWidth === 'md' && 'max-w-md',
      maxWidth === 'lg' && 'max-w-lg',
      maxWidth === 'xl' && 'max-w-xl',
      maxWidth === '2xl' && 'max-w-2xl',
      maxWidth === '3xl' && 'max-w-3xl',
      maxWidth === '4xl' && 'max-w-4xl',
      maxWidth === '5xl' && 'max-w-5xl',
      maxWidth === '6xl' && 'max-w-6xl',
      maxWidth === '7xl' && 'max-w-7xl',
      maxWidth === 'full' && 'max-w-full',
      maxWidth === 'screen' && 'max-w-screen-2xl',
      // Centering
      centered && 'mx-auto',
      // Padding - Mobile-first responsive
      padding === 0 && 'p-0',
      padding === 1 && 'p-0.5 sm:p-1',
      padding === 2 && 'p-1 sm:p-2',
      padding === 3 && 'p-2 sm:p-3',
      padding === 4 && 'p-2 sm:p-3 md:p-4',
      padding === 5 && 'p-3 sm:p-4 md:p-5',
      padding === 6 && 'p-3 sm:p-4 md:p-6',
      padding === 7 && 'p-4 sm:p-5 md:p-7',
      padding === 8 && 'p-4 sm:p-6 md:p-8',
      padding === 10 && 'p-5 sm:p-7 md:p-10',
      padding === 12 && 'p-6 sm:p-8 md:p-12',
      padding === 16 && 'p-8 sm:p-10 md:p-16',
      className
    );

    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...containerProps 
    } = props;

    return (
      <div 
        ref={ref}
        className={containerClass} 
        {...containerProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  }
);

ComponentRegistry.register('container', 
  ContainerRenderer,
  {
    namespace: 'ui',
    label: 'Container',
    inputs: [
      { 
        name: 'maxWidth', 
        type: 'enum', 
        enum: ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen'],
        label: 'Max Width',
        defaultValue: 'xl'
      },
      { 
        name: 'padding', 
        type: 'number', 
        label: 'Padding', 
        defaultValue: 4,
        description: 'Padding value (0, 1-8, 10, 12, 16)'
      },
      { 
        name: 'centered', 
        type: 'boolean', 
        label: 'Center Horizontally', 
        defaultValue: true
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      maxWidth: 'xl',
      padding: 4,
      centered: true,
      children: [
        { type: 'text', content: 'Container content goes here' }
      ]
    },
    isContainer: true,
    resizable: true,
    resizeConstraints: {
      width: true,
      height: true,
      minWidth: 200,
      minHeight: 100
    }
  }
);
