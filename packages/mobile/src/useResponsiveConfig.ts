/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { useBreakpoint } from './useBreakpoint';
import { resolveResponsiveValue } from './breakpoints';
import type { BreakpointName } from '@object-ui/types';

/**
 * Spec-aligned ResponsiveConfig (mirrors @objectstack/spec ResponsiveConfigSchema).
 *
 * @example
 * ```ts
 * const config: SpecResponsiveConfig = {
 *   columns: { xs: 12, sm: 6, lg: 4 },
 *   hiddenOn: ['xs'],
 *   order: { xs: 2, lg: 1 },
 * };
 * ```
 */
export interface SpecResponsiveConfig {
  /** The target breakpoint for this config */
  breakpoint?: BreakpointName;
  /** Breakpoints on which the component is hidden */
  hiddenOn?: BreakpointName[];
  /** Grid column counts per breakpoint (1-12) */
  columns?: Partial<Record<BreakpointName, number>>;
  /** Display order per breakpoint */
  order?: Partial<Record<BreakpointName, number>>;
}

/**
 * Resolved responsive state from a SpecResponsiveConfig.
 */
export interface ResolvedResponsiveState {
  /** Whether the component is hidden at the current breakpoint */
  hidden: boolean;
  /** Resolved column count for the current breakpoint */
  columns: number | undefined;
  /** Resolved display order for the current breakpoint */
  order: number | undefined;
  /** Current active breakpoint name */
  breakpoint: BreakpointName;
}

/**
 * Hook that consumes @objectstack/spec ResponsiveConfigSchema and
 * resolves breakpoint-aware layout state.
 *
 * @example
 * ```tsx
 * const { hidden, columns, order } = useResponsiveConfig({
 *   columns: { xs: 12, sm: 6, lg: 4 },
 *   hiddenOn: ['xs'],
 *   order: { xs: 2, lg: 1 },
 * });
 * if (hidden) return null;
 * return <div style={{ gridColumn: `span ${columns}`, order }}>...</div>;
 * ```
 */
export function useResponsiveConfig(config?: SpecResponsiveConfig): ResolvedResponsiveState {
  const { breakpoint } = useBreakpoint();

  return useMemo(() => {
    if (!config) {
      return { hidden: false, columns: undefined, order: undefined, breakpoint };
    }

    const hidden = config.hiddenOn?.includes(breakpoint) ?? false;

    const columns = config.columns
      ? resolveResponsiveValue(config.columns, breakpoint)
      : undefined;

    const order = config.order
      ? resolveResponsiveValue(config.order, breakpoint)
      : undefined;

    return { hidden, columns, order, breakpoint };
  }, [config, breakpoint]);
}
