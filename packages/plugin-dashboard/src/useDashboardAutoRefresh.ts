/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import type { DashboardComponentSchema } from '@object-ui/types';

/**
 * The dashboard auto-refresh timer — ONE implementation, two mount points
 * (objectui#8820).
 *
 * ## Why this module exists
 *
 * `DashboardGridLayout` and `DashboardRenderer` each carried a byte-identical
 * copy of the same three things: a `refreshing` flag, a `handleRefresh`
 * callback wired to both the manual "Refresh All" button and the timer, and an
 * effect that read the authored interval and drove `setInterval`. Two copies of
 * one rule is two places to update and one place to forget — and the key that
 * rule reads has just been RENAMED upstream, which is exactly the change that
 * punishes a duplicated reader: fixing one copy leaves the other silently dead
 * with no failing test, because each component's own tests still pass.
 *
 * ## The rename, and why BOTH spellings are read
 *
 * `@objectstack/spec` 17.4.0 renamed `dashboard.refreshInterval` to
 * `refreshIntervalSeconds` (objectstack#14478 / #15680) — the value is
 * unchanged, still seconds; only the key moved, so the unit lives in the name
 * instead of only in the describe prose. The old spelling became a
 * `retiredKey()` tombstone on the spec's `DashboardSchema`.
 *
 * This reader accepts BOTH, new preferred, so the fix is order-independent
 * with respect to the app repos it serves:
 *
 *   - an app already on 17.4.0 (hotcrm is, as of `main` 965933b) authors
 *     `refreshIntervalSeconds` and its dashboards refresh immediately;
 *   - an app still on 17.3.0 authors `refreshInterval` and keeps working.
 *
 * Neither app has to land on the same day as this change, in either order.
 *
 * ⚠️ This is a deliberate, time-boxed exception to AGENTS.md #0.1
 * (contract-first: no lenient renderer-side aliases). #0.1 forbids a SECOND
 * de-facto contract — two spellings that both stay legal forever. This is the
 * other shape: a one-way migration window whose end the producer, not this
 * renderer, decides.
 *
 * ## ⛔ WHEN THE FALLBACK COMES OUT
 *
 * Drop the `refreshInterval` arm — and the cast below with it — in the change
 * that raises objectui's `@objectstack/spec` floor to `^17.4.0`. That bump is
 * the terminating condition, not a guess about calendar time: from it on, the
 * spec's own `DashboardSchema` REFUSES `refreshInterval` by name (`ZodNever`
 * tombstone), so a document that still spells it that way cannot reach this
 * renderer at all — the fallback arm becomes unreachable code the moment the
 * floor moves, and keeping it would only pretend to support something the save
 * gate already rejects.
 *
 * That bump is NOT this card: objectui resolves `@objectstack/spec@17.3.0`
 * today, and moving to 17.4.0 reddens seven assertions this card does not own
 * (`job` / `flow` preview samples, `object-kanban` and `element:record_picker`
 * registry parity, the `BLOCK_CONFIG` ledger, and a pin on the spec's own
 * English `gap` help text). It has its own card.
 *
 * ## Why the read is a cast rather than a declared key
 *
 * `refreshIntervalSeconds` is deliberately NOT added to
 * `DashboardComponentSchema` here. That interface is a hand-written mirror of
 * a spec-DERIVED Zod schema, and `zod-mirror-parity.test.ts` ledgers every key
 * the declaration carries that the mirror does not — declaring it now would
 * mint a row of mirroring debt for a key the mirror gains BY REFERENCE
 * (`SpecDashboardFields`) the instant the floor moves. Reading a
 * not-yet-in-the-bundled-types spec key through a narrow cast is this
 * package's existing convention for precisely this window; see
 * `DashboardWithConfig.tsx`'s `dataset` / `dimensions` / `values` reads and
 * the comment above them. The runtime is unaffected either way: dashboard
 * nodes extend the `.passthrough()` `BaseSchema`, so the key rides through
 * validation intact under both spec versions.
 */

/** The two spellings, newest first. The order IS the precedence. */
const INTERVAL_KEYS = ['refreshIntervalSeconds', 'refreshInterval'] as const;

/**
 * The authored auto-refresh period in seconds, or `undefined` when the
 * dashboard declares none.
 *
 * ⚠️ Presence, not truthiness. `0` is an AUTHORED value meaning "off" — the
 * config panel's picker offers it as its first option — so a `||` / `??`-style
 * chain would fall through a deliberate `refreshIntervalSeconds: 0` to a stale
 * `refreshInterval: 300` left behind by a half-finished migration and start a
 * timer the author had just switched off. The first key that is PRESENT with a
 * number wins, whatever its value; `<= 0` is then handled as "off" by the one
 * gate below, exactly as the two copies this replaces did.
 *
 * Only a real `number` counts. The spec declares `z.number()` and the
 * published manifest already refuses the string form (`'30'` draws
 * `type-mismatch` — pinned in `dashboardAuthoredInputs.test.tsx`), so
 * coercing one here would be the lenient second contract #0.1 rules out.
 */
export function resolveRefreshIntervalSeconds(
  schema: DashboardComponentSchema,
): number | undefined {
  const authored = schema as unknown as Record<string, unknown>;
  for (const key of INTERVAL_KEYS) {
    const value = authored[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/** What a dashboard surface needs to drive its refresh affordance. */
export interface DashboardAutoRefresh {
  /** True while a refresh is in flight — drives the spinner and disables the button. */
  refreshing: boolean;
  /** Run a refresh now. Wired to both the manual button and the timer. */
  handleRefresh: () => void;
}

/**
 * Owns the refresh indicator, the manual refresh handler, and the auto-refresh
 * interval for one dashboard surface.
 *
 * Behaviour is that of the two copies it replaces, unchanged: the timer runs
 * only when the host wired `onRefresh` AND the authored period is a positive
 * number of seconds; the indicator clears itself 600ms after each run.
 */
export function useDashboardAutoRefresh(
  schema: DashboardComponentSchema,
  onRefresh?: () => void,
): DashboardAutoRefresh {
  const [refreshing, setRefreshing] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = React.useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    onRefresh();
    // Reset refreshing indicator after a short delay
    setTimeout(() => setRefreshing(false), 600);
  }, [onRefresh]);

  const seconds = resolveRefreshIntervalSeconds(schema);

  React.useEffect(() => {
    if (!seconds || seconds <= 0 || !onRefresh) return;
    intervalRef.current = setInterval(handleRefresh, seconds * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [seconds, onRefresh, handleRefresh]);

  return { refreshing, handleRefresh };
}
