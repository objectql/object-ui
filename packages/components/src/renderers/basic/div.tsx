/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { DivSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';

const DivRenderer = forwardRef<HTMLDivElement, { schema: DivSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    // Deprecation warning
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ObjectUI] The "div" component is deprecated. Please use Shadcn components instead:\n' +
        '  - For containers: use "card", "flex", or semantic layout components\n' +
        '  - For simple wrappers: use layout components like "container", "stack", or "grid"\n' +
        'See documentation at https://www.objectui.org/docs/components for alternatives.'
      );
    }
    
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...divProps
    } = props;
    
    return (
    <div 
        ref={ref}
        className={className} 
        {...divProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {renderChildren(schema.children || schema.body)}
    </div>
  );
  }
);

ComponentRegistry.register('div', 
  DivRenderer,
  {
    label: 'Container (Deprecated)',
    deprecated: true,
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      className: 'p-2 sm:p-4 border border-dashed border-gray-300 rounded min-h-[100px]'
    }
  }
);
