/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { useBreakpoint } from './useBreakpoint.js';
import { resolveResponsiveValue } from './breakpoints.js';
import type { BreakpointName, SpecResponsiveConfig } from '@object-ui/types';

/**
 * The responsive layout config this hook consumes — re-exported, not re-declared
 * (objectui#4598).
 *
 * This used to be a hand-written interface over the same four keys, under a
 * comment asserting it mirrored the schema. The assertion was true on the day it
 * was written and maintained by nobody after that: the interface named the
 * schema without ever referring to it, so a key added or retired upstream would
 * have moved the two apart in silence. `ViewNavigationConfig` (objectui#4588)
 * read the same way until it had drifted on `mode`.
 *
 * `@object-ui/types` — already this package's only runtime dependency — publishes
 * the schema's own type at `index.ts` under this exact name, imported from
 * `@objectstack/spec/ui` rather than copied. Re-exporting it costs no new
 * dependency edge and leaves the published name unchanged, so the four keys are
 * now whatever the schema says they are rather than whatever this file last
 * remembered. `@object-ui/core`'s `ResponsiveProtocol` already binds through the
 * same re-export.
 *
 * `responsive-config-spec-parity.test.ts` pins the chain to the schema itself,
 * because the one link this file cannot see is `@object-ui/types` re-growing a
 * hand copy of its own.
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
export type { SpecResponsiveConfig };

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
