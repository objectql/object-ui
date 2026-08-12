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

/**
 * Deprecated types already reported in this module instance — the notice is a
 * property of the TYPE, not of the node, so one report per page load is the
 * whole signal. Mirrors the warn-once machinery in `layout/containers.tsx`.
 */
const _warnedDeprecations = new Set<string>();

/**
 * Report the deprecation ONCE per type per module load.
 *
 * The renderer used to warn on every single render, which turns any page with
 * many `div` nodes into a console flood: the docs schema-catalog index renders
 * 400+ example thumbnails and produced ~190 identical notices, burying the
 * real errors underneath (it twice cost a browser-verification run the signal
 * it was looking for — objectui#3965, discovered during #3903 / PR #3964).
 *
 * The deprecation itself is unchanged and still fires in dev builds; only the
 * repetition is dropped. Order matters: the production check returns BEFORE the
 * seen-set is marked, so a production render never suppresses the dev notice.
 */
function warnDeprecatedOnce(type: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (_warnedDeprecations.has(type)) return;
  _warnedDeprecations.add(type);
  console.warn(message);
}

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const DivRenderer = forwardRef<HTMLDivElement, { schema: DivSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: DivSchema; className?: string; [key: string]: any }, ref) => {
    // Deprecation warning (once per module load — see warnDeprecatedOnce)
    warnDeprecatedOnce(
      'div',
      '[ObjectUI] The "div" component is deprecated. Please use Shadcn components instead:\n' +
      '  - For containers: use "card", "flex", or semantic layout components\n' +
      '  - For simple wrappers: use layout components like "container", "stack", or "grid"\n' +
      'See documentation at https://www.objectui.org/docs/components for alternatives.'
    );

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
    namespace: 'ui',
    label: 'Container (Deprecated)',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      className: 'p-2 sm:p-4 border border-dashed border-gray-300 rounded min-h-[100px]'
    }
  }
);
