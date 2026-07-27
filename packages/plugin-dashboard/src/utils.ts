/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Returns true when the widget data config uses provider: 'object' (async data source). */
export function isObjectProvider(widgetData: unknown): widgetData is { provider: 'object'; object?: string; aggregate?: any; filter?: any } {
  return (
    widgetData != null &&
    typeof widgetData === 'object' &&
    !Array.isArray(widgetData) &&
    (widgetData as any).provider === 'object'
  );
}

// Re-export the date-macro resolver from core so existing internal imports
// (`import { resolveDateMacros } from './utils'`) keep working.
//
// Prefer `resolveFilterPlaceholders` in renderers: it expands BOTH placeholder
// vocabularies (date macros AND `{current_user_id}` / `{current_org_id}`).
// Calling `resolveDateMacros` alone is exactly what left every dashboard
// widget unable to resolve user-scoped filters — they silently rendered 0
// (framework #3574).
export { resolveDateMacros, resolveFilterPlaceholders } from '@object-ui/core';

// Re-export compareTo helpers from core for convenience.
export {
  shiftFilterByCompareTo,
  compareToTrendLabelKey,
  type CompareToConfig,
} from '@object-ui/core';

/**
 * Compute a percentage delta between the current and previous metric values.
 *
 * Returns `null` when comparison is meaningless:
 * - current is not finite (null / undefined / NaN / Infinity)
 * - previousValue is null / undefined (no comparison data)
 *
 * Edge cases:
 * - both 0 → neutral
 * - previous is 0 and current ≠ 0 → 100% in current's direction
 * - previous is negative → uses |previous| as denominator so that "less
 *   negative" reads as a positive (up) delta.
 */
export function computeMetricDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): { value: number; direction: 'up' | 'down' | 'neutral' } | null {
  if (previous === null || previous === undefined) return null;
  if (current === null || current === undefined) return null;
  if (typeof current !== 'number' || !Number.isFinite(current)) return null;
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return null;

  if (previous === 0) {
    if (current === 0) return { value: 0, direction: 'neutral' };
    return { value: 100, direction: current > 0 ? 'up' : 'down' };
  }

  const diff = current - previous;
  if (diff === 0) return { value: 0, direction: 'neutral' };
  const pct = Math.round((diff / Math.abs(previous)) * 100);
  return {
    value: Math.abs(pct),
    direction: pct > 0 ? 'up' : 'down',
  };
}
