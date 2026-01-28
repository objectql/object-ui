/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { SpanSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';

const SpanRenderer = forwardRef<HTMLSpanElement, { schema: SpanSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    // Deprecation warning
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ObjectUI] The "span" component is deprecated. Please use Shadcn components instead:\n' +
        '  - For badges/labels: use "badge" component\n' +
        '  - For inline text emphasis: use "text" component with appropriate className\n' +
        'See documentation at https://www.objectui.org/docs/components for alternatives.'
      );
    }
    
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...spanProps
    } = props;
    
    return (
    <span 
        ref={ref}
        className={className} 
        {...spanProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {renderChildren(schema.body)}
    </span>
  );
  }
);

ComponentRegistry.register('span', 
  SpanRenderer,
  {
    label: 'Inline Container (Deprecated)',
    deprecated: true,
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      className: 'px-1.5 py-0.5 sm:px-2 sm:py-1'
    },
    defaultChildren: [
      { type: 'text', content: 'Inline text' }
    ]
  }
);
