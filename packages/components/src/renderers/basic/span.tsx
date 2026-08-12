/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { TextSpanSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const SpanRenderer = forwardRef<HTMLSpanElement, { schema: TextSpanSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: TextSpanSchema; className?: string; [key: string]: any }, ref) => {
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
    namespace: 'ui',
    label: 'Inline Container (Deprecated)',
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
