/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Responsive Protocol Bridge
 *
 * Converts spec-aligned ResponsiveConfig schemas into Tailwind CSS
 * utility classes for visibility, grid columns, and ordering across
 * breakpoints. Also provides runtime width-based visibility checks.
 *
 * @module protocols/ResponsiveProtocol
 * @packageDocumentation
 */

import type { SpecResponsiveConfig } from '@object-ui/types';

// ============================================================================
// Breakpoint Definitions
// ============================================================================

/** Breakpoint name type matching Tailwind defaults. */
export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Breakpoint minimum pixel widths aligned with Tailwind CSS defaults. */
export const BREAKPOINT_VALUES: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/** Ordered breakpoint keys from smallest to largest. */
const BREAKPOINT_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

// ============================================================================
// Resolved Types
// ============================================================================

/** Fully resolved responsive configuration. */
export interface ResolvedResponsiveConfig {
  breakpoint?: BreakpointKey;
  hiddenOn: BreakpointKey[];
  columns: Partial<Record<BreakpointKey, number>>;
  order: Partial<Record<BreakpointKey, number>>;
}

// ============================================================================
// Config Resolution
// ============================================================================

/**
 * Resolve a responsive configuration by applying defaults.
 *
 * @param config - SpecResponsiveConfig from the spec
 * @returns Fully resolved responsive configuration
 */
export function resolveResponsiveConfig(config: SpecResponsiveConfig): ResolvedResponsiveConfig {
  return {
    breakpoint: config.breakpoint as BreakpointKey | undefined,
    hiddenOn: (config.hiddenOn ?? []) as BreakpointKey[],
    columns: (config.columns ?? {}) as Partial<Record<BreakpointKey, number>>,
    order: (config.order ?? {}) as Partial<Record<BreakpointKey, number>>,
  };
}

// ============================================================================
// Visibility Classes
// ============================================================================

/**
 * Generate Tailwind CSS classes for responsive visibility.
 *
 * If `breakpoint` is set, the element is hidden below that breakpoint
 * (e.g. breakpoint "md" → `['hidden', 'md:block']`).
 *
 * If `hiddenOn` contains breakpoints, the element is hidden at those
 * specific sizes (e.g. hiddenOn: ["sm", "lg"] → `['sm:hidden', 'md:block', 'lg:hidden', 'xl:block']`).
 *
 * @param config - SpecResponsiveConfig from the spec
 * @returns Array of Tailwind CSS class strings
 */
export function getVisibilityClasses(config: SpecResponsiveConfig): string[] {
  const classes: string[] = [];

  // Minimum breakpoint visibility
  if (config.breakpoint) {
    const bp = config.breakpoint as BreakpointKey;
    if (bp !== 'xs') {
      classes.push('hidden');
      classes.push(`${bp}:block`);
    }
  }

  // Per-breakpoint hidden overrides
  const hiddenOn = (config.hiddenOn ?? []) as BreakpointKey[];
  if (hiddenOn.length > 0) {
    for (let i = 0; i < BREAKPOINT_ORDER.length; i++) {
      const bp = BREAKPOINT_ORDER[i];
      const isHidden = hiddenOn.includes(bp);
      const prevHidden = i > 0 ? hiddenOn.includes(BREAKPOINT_ORDER[i - 1]) : false;

      if (isHidden && !prevHidden) {
        classes.push(bp === 'xs' ? 'hidden' : `${bp}:hidden`);
      } else if (!isHidden && prevHidden) {
        classes.push(bp === 'xs' ? 'block' : `${bp}:block`);
      }
    }
  }

  return classes;
}

// ============================================================================
// Column Classes
// ============================================================================

/**
 * Generate Tailwind grid-cols classes for responsive column layouts.
 *
 * @param config - SpecResponsiveConfig from the spec
 * @returns Array of Tailwind CSS grid column class strings
 */
export function getColumnClasses(config: SpecResponsiveConfig): string[] {
  const classes: string[] = [];
  const columns = (config.columns ?? {}) as Partial<Record<BreakpointKey, number>>;

  for (const bp of BREAKPOINT_ORDER) {
    const cols = columns[bp];
    if (cols == null) continue;
    const prefix = bp === 'xs' ? '' : `${bp}:`;
    classes.push(`${prefix}grid-cols-${cols}`);
  }

  return classes;
}

// ============================================================================
// Order Classes
// ============================================================================

/**
 * Generate Tailwind order utility classes for responsive ordering.
 *
 * @param config - SpecResponsiveConfig from the spec
 * @returns Array of Tailwind CSS order class strings
 */
export function getOrderClasses(config: SpecResponsiveConfig): string[] {
  const classes: string[] = [];
  const order = (config.order ?? {}) as Partial<Record<BreakpointKey, number>>;

  for (const bp of BREAKPOINT_ORDER) {
    const ord = order[bp];
    if (ord == null) continue;
    const prefix = bp === 'xs' ? '' : `${bp}:`;
    classes.push(`${prefix}order-${ord}`);
  }

  return classes;
}

// ============================================================================
// Runtime Width Check
// ============================================================================

/**
 * Determine whether a component should be hidden at a given viewport width.
 *
 * Checks both the minimum `breakpoint` threshold and the `hiddenOn` list.
 *
 * @param config - SpecResponsiveConfig from the spec
 * @param width - Current viewport width in pixels
 * @returns `true` if the component should be hidden at the given width
 */
export function shouldHideAtBreakpoint(config: SpecResponsiveConfig, width: number): boolean {
  // Check minimum breakpoint
  if (config.breakpoint) {
    const minWidth = BREAKPOINT_VALUES[config.breakpoint as BreakpointKey];
    if (minWidth !== undefined && width < minWidth) {
      return true;
    }
  }

  // Check hiddenOn list
  const hiddenOn = (config.hiddenOn ?? []) as BreakpointKey[];
  if (hiddenOn.length > 0) {
    const currentBp = getCurrentBreakpoint(width);
    return hiddenOn.includes(currentBp);
  }

  return false;
}

/**
 * Determine the current breakpoint name for a given width.
 */
function getCurrentBreakpoint(width: number): BreakpointKey {
  for (let i = BREAKPOINT_ORDER.length - 1; i >= 0; i--) {
    if (width >= BREAKPOINT_VALUES[BREAKPOINT_ORDER[i]]) {
      return BREAKPOINT_ORDER[i];
    }
  }
  return 'xs';
}
