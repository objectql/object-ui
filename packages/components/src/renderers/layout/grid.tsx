/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, toDomProps } from '@object-ui/core';
import type { GridSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';

// Helper maps to ensure Tailwind classes are scanned and included
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
  5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
  9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12'
};

const GRID_COLS_SM: Record<number, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 7: 'sm:grid-cols-7', 8: 'sm:grid-cols-8',
  9: 'sm:grid-cols-9', 10: 'sm:grid-cols-10', 11: 'sm:grid-cols-11', 12: 'sm:grid-cols-12'
};

const GRID_COLS_MD: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4',
  5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8',
  9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12'
};

const GRID_COLS_LG: Record<number, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-8',
  9: 'lg:grid-cols-9', 10: 'lg:grid-cols-10', 11: 'lg:grid-cols-11', 12: 'lg:grid-cols-12'
};

const GRID_COLS_XL: Record<number, string> = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 7: 'xl:grid-cols-7', 8: 'xl:grid-cols-8',
  9: 'xl:grid-cols-9', 10: 'xl:grid-cols-10', 11: 'xl:grid-cols-11', 12: 'xl:grid-cols-12'
};

// `2xl` is the sixth and last member of the breakpoint vocabulary — `BreakpointName`
// in `@object-ui/types`, `BREAKPOINTS` / `BREAKPOINT_ORDER` in `@object-ui/mobile`,
// and `BreakpointColumnMap` in `@object-ui/layout`, whose `ResponsiveGrid` already
// emits `2xl:grid-cols-*`. This map stopped at `xl`, and so did the read arm below,
// so an authored `columns: { '2xl': 6 }` validated, emitted nothing, and rendered at
// the `xs` count on every screen (objectui#7097).
//
// The map is not decoration: it is what makes these class names EXIST. Tailwind v4
// finds utilities by scanning source text (`@source '../src/**/*.{ts,tsx}'` in
// `packages/components/src/index.css`), so a `2xl:grid-cols-${n}` built at runtime
// from a template would never be compiled and the node would render unstyled — green
// in a unit test, wrong in the browser. Spelling all twelve out is the same reason
// the five maps above are spelled out. The variant itself is Tailwind's default
// `2xl` (96rem / 1536px, matching `BREAKPOINTS['2xl']`); no `@theme` block in this
// repo overrides `--breakpoint-*`.
const GRID_COLS_2XL: Record<number, string> = {
  1: '2xl:grid-cols-1', 2: '2xl:grid-cols-2', 3: '2xl:grid-cols-3', 4: '2xl:grid-cols-4',
  5: '2xl:grid-cols-5', 6: '2xl:grid-cols-6', 7: '2xl:grid-cols-7', 8: '2xl:grid-cols-8',
  9: '2xl:grid-cols-9', 10: '2xl:grid-cols-10', 11: '2xl:grid-cols-11', 12: '2xl:grid-cols-12'
};

const GAPS: Record<number, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 
  5: 'gap-5', 6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12'
};

ComponentRegistry.register('grid', 
  ({ schema, className, ...props }: { schema: GridSchema & { smColumns?: number, mdColumns?: number, lgColumns?: number, xlColumns?: number }; className?: string; [key: string]: any }) => {
    // Determine columns configuration
    // Supports detailed object configuration from schema
    let baseCols = 2;
    let smCols, mdCols, lgCols, xlCols, xxlCols;

    if (typeof schema.columns === 'number') {
      baseCols = schema.columns;
    } else if (typeof schema.columns === 'object' && schema.columns !== null) {
      // Handle responsive object: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 6 }
      // Note: 'xs' corresponds to base (mobile-first)
      baseCols = schema.columns.xs ?? 1;
      smCols = schema.columns.sm;
      mdCols = schema.columns.md;
      lgCols = schema.columns.lg;
      xlCols = schema.columns.xl;
      // `xxlCols` because `2xlCols` is not a legal identifier; the authored key
      // is and stays `'2xl'`.
      xxlCols = schema.columns['2xl'];
    }

    // Fallback to legacy flat props if provided (from designer)
    if (schema.smColumns) smCols = schema.smColumns;
    if (schema.mdColumns) mdCols = schema.mdColumns;
    if (schema.lgColumns) lgCols = schema.lgColumns;
    if (schema.xlColumns) xlCols = schema.xlColumns;

    // Mobile-first ramp: a bare numeric `columns` (no explicit responsive
    // overrides) collapses on small screens so an N-across row doesn't render
    // as unreadable slivers on a phone. Authors who pass a responsive object
    // or sm/md/lg/xlColumns keep full control.
    //
    // `xxlCols` is deliberately NOT in this condition. It is only ever set from
    // the responsive-object branch above, which this arm cannot have taken
    // (`typeof schema.columns === 'number'`), and there is no `xxlColumns`
    // legacy flat prop — the designer's flat channel stays at the five it
    // declares in `inputs` below. Add it here if that ever changes.
    if (
      typeof schema.columns === 'number' && baseCols > 1 &&
      smCols === undefined && mdCols === undefined && lgCols === undefined && xlCols === undefined
    ) {
      mdCols = baseCols;
      smCols = Math.min(2, baseCols);
      baseCols = 1;
    }

    const gap = schema.gap ?? 4;
    
    // Generate Tailwind grid classes
    const gridClass = cn(
      'grid',
      // Base columns
      GRID_COLS[baseCols] || 'grid-cols-2',
      // Responsive columns
      smCols && GRID_COLS_SM[smCols],
      mdCols && GRID_COLS_MD[mdCols],
      lgCols && GRID_COLS_LG[lgCols],
      xlCols && GRID_COLS_XL[xlCols],
      xxlCols && GRID_COLS_2XL[xxlCols],
      // Gap
      GAPS[gap] || `gap-[${gap * 0.25}rem]`, // Fallback for arbitrary values if not in map
      className
    );

    // DOM pass-through is a WHITELIST, never a list of keys to strip — objectui#3291's
    // discipline, promoted out of `packages/fields` to `@object-ui/core` by
    // objectui#4425 phase 2 and executed here by {@link toDomProps}.
    //
    // `SchemaRenderer` hands this renderer the authored node's own keys, the contents
    // of its `props` container, and any extra key the author wrote. The bare
    // `{...gridProps}` spread this replaces put all of it on the div as invalid HTML
    // attributes — measured on a canary node: `columns="4"`, `gap="4"`, `mdcolumns="2"`,
    // `smcolumns="2"`, `name="grid_node"`, `props="[object Object]"`,
    // `colorvariant="x"` and an unknown authored `zzcanary="leak"`, eight in all
    // (objectui#4787). Only `data-obj-*`/`style` were ever removed.
    //
    // Enumerating today's GridSchema keys instead would re-rot the moment the schema
    // grows one, and could never name the OPEN TAIL — `zzcanary` and the flattened
    // `props` container are author-supplied, so no finite list reaches them. The
    // whitelist keeps what is DECLARED DOM-safe (`id`, `className`, `role`, `tabIndex`,
    // … plus the open `data-*` / `aria-*` families, which is how `data-obj-id` and
    // `data-obj-type` still arrive) and drops everything else by construction.
    //
    // `style` is forwarded BY NAME rather than reopened in the shared whitelist (the
    // objectui#4435 route): it is this container's designer sizing channel, but the
    // shared set is deliberately element-agnostic and nothing element-specific belongs
    // in it. Grid's own keys (`columns`, `gap`, `smColumns`…) are CONSUMED off `schema`
    // above and must never be forwarded.
    const { style, ...hostProps } = props;

    return (
      <div
        {...toDomProps(hostProps)}
        className={gridClass}
        style={style}
      >
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Grid Layout',
    inputs: [
      { 
        name: 'columns', 
        type: 'number', 
        description: 'Number of columns on mobile devices'
      },
      { 
        name: 'smColumns', 
        type: 'number', 
        description: 'Columns at sm breakpoint (>640px)'
      },
      { 
        name: 'mdColumns', 
        type: 'number', 
        description: 'Columns at md breakpoint (>768px)'
      },
      { 
        name: 'lgColumns', 
        type: 'number', 
        description: 'Columns at lg breakpoint (>1024px)'
      },
      { 
        name: 'xlColumns', 
        type: 'number', 
        description: 'Columns at xl breakpoint (>1280px)'
      },
      { 
        name: 'gap', 
        type: 'number', 
        description: 'Gap between items (0-12)'
      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      columns: 1,
      mdColumns: 2,
      lgColumns: 4,
      gap: 4,
      children: [
        { type: 'card', title: 'Card 1', description: 'First card' },
        { type: 'card', title: 'Card 2', description: 'Second card' },
        { type: 'card', title: 'Card 3', description: 'Third card' },
        { type: 'card', title: 'Card 4', description: 'Fourth card' }
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
