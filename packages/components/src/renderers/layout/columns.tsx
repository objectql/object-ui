/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ColumnsSchema, ColumnDef } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

// ─── Preset width definitions ────────────────────────────────────────────────

const PRESETS: Record<string, string[]> = {
  'equal-2': ['1/2', '1/2'],
  'equal-3': ['1/3', '1/3', '1/3'],
  'equal-4': ['1/4', '1/4', '1/4', '1/4'],
  'sidebar-main': ['1/4', '3/4'],
  'main-sidebar': ['3/4', '1/4'],
  'sidebar-main-aside': ['1/5', '3/5', '1/5'],
  'golden': ['2/5', '3/5'],
};

// ─── Width fraction → Tailwind class maps ────────────────────────────────────
// We use explicit maps so Tailwind's JIT scanner picks up the classes.

const WIDTH_CLASSES: Record<string, string> = {
  '1/2': 'w-full md:w-1/2',
  '1/3': 'w-full md:w-1/3',
  '2/3': 'w-full md:w-2/3',
  '1/4': 'w-full md:w-1/4',
  '3/4': 'w-full md:w-3/4',
  '1/5': 'w-full md:w-1/5',
  '2/5': 'w-full md:w-2/5',
  '3/5': 'w-full md:w-3/5',
  '4/5': 'w-full md:w-4/5',
  '1/6': 'w-full md:w-1/6',
  '5/6': 'w-full md:w-5/6',
  'auto': 'w-auto',
  'fill': 'flex-1 min-w-0',
  'full': 'w-full',
};

// Grid column span equivalents for grid-based layout
const GRID_COL_SPAN: Record<string, string> = {
  '1/2': 'md:col-span-6',
  '1/3': 'md:col-span-4',
  '2/3': 'md:col-span-8',
  '1/4': 'md:col-span-3',
  '3/4': 'md:col-span-9',
  '1/5': 'md:col-span-2',
  '2/5': 'md:col-span-5',
  '3/5': 'md:col-span-7',
  '4/5': 'md:col-span-10',
  '1/6': 'md:col-span-2',
  '5/6': 'md:col-span-10',
};

const GAPS: Record<number, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4',
  5: 'gap-5', 6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
};

// ─── Renderer ────────────────────────────────────────────────────────────────

const ColumnsRenderer = forwardRef<
  HTMLDivElement,
  { schema: ColumnsSchema; className?: string; [key: string]: any }
>(({ schema, className, ...props }, ref) => {
  const gap = schema.gap ?? 4;
  const stackOnMobile = schema.stackOnMobile !== false; // default true
  const align = schema.align || 'stretch';

  // Resolve column widths from preset or explicit definitions
  const presetWidths = schema.preset ? PRESETS[schema.preset] : undefined;
  const columns: ColumnDef[] = schema.columns || [];

  // Use CSS Grid with 12-column system for precise fraction widths
  const useGrid = columns.some((col, i) => {
    const w = (typeof col.width === 'string' ? col.width : undefined) || presetWidths?.[i];
    return w && GRID_COL_SPAN[w];
  });

  if (useGrid) {
    // Grid-based approach for fraction widths
    const containerClass = cn(
      'grid',
      stackOnMobile ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-12',
      GAPS[gap] || 'gap-4',
      ALIGN_MAP[align] || 'items-stretch',
      className,
    );

    const { 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style, ...rest } = props;

    return (
      <div
        ref={ref}
        className={containerClass}
        {...rest}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
      >
        {columns.map((col, i) => {
          const width = (typeof col.width === 'string' ? col.width : undefined) || presetWidths?.[i] || 'fill';
          const colSpan = GRID_COL_SPAN[width] || 'md:col-span-6';
          const colClass = cn(
            stackOnMobile ? 'col-span-1' : '',
            colSpan,
            col.className,
          );
          return (
            <div key={col.id || `col-${i}`} className={colClass}>
              {col.children && renderChildren(col.children)}
            </div>
          );
        })}
      </div>
    );
  }

  // Flex-based approach for auto / fill widths
  const containerClass = cn(
    stackOnMobile ? 'flex flex-col md:flex-row' : 'flex flex-row',
    GAPS[gap] || 'gap-4',
    ALIGN_MAP[align] || 'items-stretch',
    className,
  );

  const { 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style, ...rest } = props;

  return (
    <div
      ref={ref}
      className={containerClass}
      {...rest}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    >
      {columns.map((col, i) => {
        const width = (typeof col.width === 'string' ? col.width : undefined) || presetWidths?.[i] || 'fill';
        const widthClass = WIDTH_CLASSES[width] || 'flex-1 min-w-0';
        const colClass = cn(widthClass, col.className);
        const colStyle: React.CSSProperties = {};
        if (col.minWidth) colStyle.minWidth = col.minWidth;
        if (col.maxWidth) colStyle.maxWidth = col.maxWidth;
        return (
          <div key={col.id || `col-${i}`} className={colClass} style={Object.keys(colStyle).length > 0 ? colStyle : undefined}>
            {col.children && renderChildren(col.children)}
          </div>
        );
      })}
    </div>
  );
});

ColumnsRenderer.displayName = 'ColumnsRenderer';

// ─── Register ────────────────────────────────────────────────────────────────

ComponentRegistry.register('columns', ColumnsRenderer, {
  namespace: 'ui',
  label: 'Columns Layout',
  category: 'Layout',
  isContainer: true,
  inputs: [
    {
      name: 'preset',
      type: 'string',
      label: 'Layout Preset',
      description: 'Predefined column arrangement',
    },
    {
      name: 'gap',
      type: 'number',
      label: 'Gap',
      defaultValue: 4,
      description: 'Gap between columns (0-12)',
    },
    {
      name: 'stackOnMobile',
      type: 'boolean',
      label: 'Stack on Mobile',
      defaultValue: true,
    },
    {
      name: 'align',
      type: 'string',
      label: 'Vertical Alignment',
      defaultValue: 'stretch',
    },
    { name: 'className', type: 'string', label: 'CSS Class' },
  ],
  defaultProps: {
    preset: 'equal-2',
    gap: 4,
    columns: [
      { children: [{ type: 'card', title: 'Column 1', description: 'Left column' }] },
      { children: [{ type: 'card', title: 'Column 2', description: 'Right column' }] },
    ],
  },
});
