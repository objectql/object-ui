/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { cn } from '@object-ui/components';

/**
 * Spec-aligned breakpoint column map (mirrors @objectstack/spec BreakpointColumnMapSchema).
 * Maps breakpoint names to grid column counts (1-12).
 */
export interface BreakpointColumnMap {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}

/**
 * Spec-aligned breakpoint order map (mirrors @objectstack/spec BreakpointOrderMapSchema).
 * Maps breakpoint names to display order numbers.
 */
export interface BreakpointOrderMap {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}

export interface ResponsiveGridProps {
  /** Grid column map per breakpoint */
  columns?: BreakpointColumnMap;
  /** Gap between grid items */
  gap?: number | string;
  /** Additional class names */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Tailwind class mapping for grid columns at each breakpoint.
 * Uses standard Tailwind grid-cols utilities for CSS-only responsiveness.
 */
const COLS_CLASSES: Record<string, Record<number, string>> = {
  xs: { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 6: 'grid-cols-6', 12: 'grid-cols-12' },
  sm: { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 6: 'sm:grid-cols-6', 12: 'sm:grid-cols-12' },
  md: { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 6: 'md:grid-cols-6', 12: 'md:grid-cols-12' },
  lg: { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12' },
  xl: { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 6: 'xl:grid-cols-6', 12: 'xl:grid-cols-12' },
  '2xl': { 1: '2xl:grid-cols-1', 2: '2xl:grid-cols-2', 3: '2xl:grid-cols-3', 4: '2xl:grid-cols-4', 6: '2xl:grid-cols-6', 12: '2xl:grid-cols-12' },
};

/**
 * Resolve a BreakpointColumnMap into Tailwind CSS grid classes.
 */
function resolveColumnClasses(columns?: BreakpointColumnMap): string {
  if (!columns) return 'grid-cols-1';

  const classes: string[] = [];
  for (const [bp, cols] of Object.entries(columns)) {
    const bpClasses = COLS_CLASSES[bp];
    if (bpClasses && cols) {
      // Use closest supported column count
      const supported = Object.keys(bpClasses).map(Number);
      const closest = supported.reduce((prev, curr) =>
        Math.abs(curr - cols) < Math.abs(prev - cols) ? curr : prev
      );
      classes.push(bpClasses[closest]);
    }
  }

  return classes.join(' ') || 'grid-cols-1';
}

const GAP_CLASSES: Record<number, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4',
  5: 'gap-5', 6: 'gap-6', 8: 'gap-8',
};

/**
 * ResponsiveGrid — A layout component that consumes @objectstack/spec
 * BreakpointColumnMapSchema for responsive grid layouts.
 *
 * Uses pure Tailwind CSS classes for responsive behavior (no JS resize listeners).
 *
 * @example
 * ```tsx
 * <ResponsiveGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap={4}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </ResponsiveGrid>
 * ```
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  columns,
  gap = 4,
  className,
  children,
}) => {
  const colClasses = resolveColumnClasses(columns);
  const gapClass = typeof gap === 'number' ? (GAP_CLASSES[gap] || `gap-${gap}`) : '';

  return (
    <div className={cn('grid', colClasses, gapClass, className)}>
      {children}
    </div>
  );
};
