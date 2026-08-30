/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, toDomProps } from '@object-ui/core';
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

    // DOM pass-through is a WHITELIST, never a list of keys to strip — the
    // objectui#3291 discipline, executed by {@link toDomProps} and already landed
    // on the sibling `grid.tsx` (objectui#4787 / PR #5573), whose docblock carries
    // the full argument. This replaces the bare `{...flexProps}` spread, which
    // forwarded everything `SchemaRenderer` hands a renderer — the authored node's
    // own keys, the flattened `props` container, the injected adapter and any
    // extra key the author wrote — onto the div as invalid HTML attributes.
    //
    // MEASURED, not assumed (objectui#5574): every `flex` node in
    // `examples/schema-catalog` rendered through the real `SchemaRenderer`, then
    // read off the DOM — 494 illegitimate attributes across 248 nodes, led by
    // `align` (198), `gap` (193), `justify` (98) and `direction` (5). Each of
    // those four is a key CONSUMED off `schema` above and turned into a class;
    // forwarding it as well is pure leakage. All four are all-lowercase, so React
    // reports none of them — which is why the pin is the DOM-reading sweep in
    // `packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx` rather
    // than a warning-as-error rule. `grid`'s 26 nodes read ZERO under the same
    // probe, which is the control saying the reading is real.
    //
    // `style` is forwarded BY NAME rather than reopened in the shared whitelist
    // (the objectui#4435 route): it is this container's designer sizing channel,
    // and the shared set is deliberately element-agnostic. `data-obj-id` /
    // `data-obj-type` need no special handling — they arrive through the open
    // `data-*` family {@link toDomProps} already forwards.
    const { style, ...hostProps } = props;

    return (
      <div 
        {...toDomProps(hostProps)}
        className={flexClass} 
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
    },
    // `flex` renders `schema.children` (see `renderChildren` above) but did not
    // DECLARE that it does, while `grid`, `card`, `container` and `stack` — the
    // same directory, the same `ui` namespace — all do. The flag is not read by
    // the render path, so nothing was broken at runtime; its consumers are
    // elsewhere, and the gap made them contradict the renderer (objectui#6740).
    //
    // MEASURED, not inferred. Building the manifest the way the app builds it
    // (`getKnownTypes()` + `getMeta()` -> `manifestFromConfigs`) and putting a
    // `flex` node WITH children through `validateTree` returned
    // `["not-a-container"]`, while `grid` / `card` / `container` under the same
    // probe returned `[]` — the control that makes the reading real. Downstream,
    // objectstack's three shipped `examples/app-showcase` html pages drew 32
    // `not-a-container` warnings, every one of them on `flex` and `flex` the
    // only source of them.
    //
    // `isContainer` alone, deliberately. The four `ui`-namespace siblings pair
    // it with `resizable` / `resizeConstraints`, but the `page:*` containers in
    // `containers.tsx` declare `isContainer: true` on its own — so the flag is
    // independent of designer resize affordances, and minting one here would be
    // a behaviour change this card did not measure.
    isContainer: true
  }
);
