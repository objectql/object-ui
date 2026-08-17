/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { isHtmlTierNode } from '@object-ui/sdui-parser';
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

/**
 * The notice, including WHICH AUTHORING SURFACE it is about.
 *
 * Scope is part of the message, not decoration. This type is deprecated on the
 * JSON surface and simultaneously a permanent, first-class tag of the
 * `kind:'html'` tier — an author there writes the plain box tag and our own
 * parser maps it straight through, and no other spelling exists for them to
 * migrate to. A notice that says the type is deprecated FULL STOP is therefore
 * false for one of its two readers, and it was the reader who could do nothing
 * about it who kept receiving it (objectui#4000).
 *
 * The migration guidance below is byte-for-byte what it was: this issue narrows
 * WHO is told, it does not water down WHAT they are told.
 */
const DIV_DEPRECATION_NOTICE =
  '[ObjectUI] The "div" component is deprecated for JSON-authored pages. Please use Shadcn components instead:\n' +
  '  - For containers: use "card", "flex", or semantic layout components\n' +
  '  - For simple wrappers: use layout components like "container", "stack", or "grid"\n' +
  '  This applies to JSON-authored nodes. In a kind:\'html\' page the tag is part of that tier\'s own\n' +
  '  vocabulary, is compiled straight through, and is not reported here.\n' +
  'See documentation at https://www.objectui.org/docs/components for alternatives.';

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const DivRenderer = forwardRef<HTMLDivElement, { schema: DivSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: DivSchema; className?: string; [key: string]: any }, ref) => {
    // Deprecation notice — JSON-authored nodes only (objectui#4000), once per
    // module load (objectui#3965, see warnDeprecatedOnce).
    //
    // ORDER, same discipline as the production early-return inside
    // warnDeprecatedOnce: the exemption is checked BEFORE the seen-set is
    // marked. An html-tier node rendering first must not latch the guard, or it
    // would swallow the notice a JSON-authored node earns later on the same
    // page — silencing exactly the reader this notice is for.
    //
    // The test is provenance, established by the producer (the parser stamps
    // what it emits), not a guess about the node's shape here.
    if (!isHtmlTierNode(schema)) {
      warnDeprecatedOnce('div', DIV_DEPRECATION_NOTICE);
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
