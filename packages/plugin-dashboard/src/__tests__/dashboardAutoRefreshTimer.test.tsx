/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The dashboard auto-refresh timer actually STARTS — observed firing, on both
 * mount points, from both spellings (objectui#8820).
 *
 * ## Why this file exists at all
 *
 * `@objectstack/spec` 17.4.0 renamed `dashboard.refreshInterval` to
 * `refreshIntervalSeconds`. Every test this repo already had for that key
 * pinned a DECLARATION — that `inputs` publishes it, that the config panel
 * carries a field with that key, that the zh overlay has a label for it. Not
 * one of them would have gone red while the timer sat there reading a key
 * nobody authors any more: a declaration assertion cannot tell a live timer
 * from a dead one, and "auto-refresh silently never starts" is precisely the
 * failure the rename produced downstream.
 *
 * So the assertion here is `onRefresh` being CALLED, after wall-clock time the
 * fixture's own period asks for. Fake timers, `advanceTimersByTime`, real
 * mounted components — no spying on `setInterval`, because a test that
 * asserted `setInterval` was called with `30000` would also pass if the effect
 * that calls it were unreachable behind the wrong prop.
 *
 * ## Both mount points, deliberately
 *
 * The timer used to exist as two byte-identical copies, in
 * `DashboardGridLayout` and in `DashboardRenderer`. objectui#8820 unified them
 * onto `useDashboardAutoRefresh`, and these cases are the proof that the
 * unification did not quietly drop one of the two call sites: each component
 * is mounted and driven on its own. ⛔ Do not collapse them into a single
 * parameterised case over the hook — the hook working is not the claim; the
 * claim is that both components still WIRE it.
 *
 * ## Both spellings, deliberately
 *
 * The reader prefers `refreshIntervalSeconds` and falls back to
 * `refreshInterval` for the length of the migration window (see
 * `useDashboardAutoRefresh.ts` for when the fallback comes out). Both arms are
 * exercised, plus the case that makes "prefer" mean something: a document
 * carrying BOTH must use the new one.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import type { DashboardComponentSchema } from '@object-ui/types';
import { DashboardGridLayout } from '../DashboardGridLayout';
import { DashboardRenderer } from '../DashboardRenderer';
import { resolveRefreshIntervalSeconds } from '../useDashboardAutoRefresh';

// Both surfaces render each widget through `SchemaRenderer`. This suite is
// about the timer, so the inner renderer is stubbed — every fixture below is
// widget-less anyway, and the stub keeps a registry miss from being mistaken
// for a timer failure.
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@object-ui/react')>();
  return {
    ...actual,
    SchemaRenderer: () => <div data-testid="widget-body" />,
  };
});

const dash = (root: Record<string, unknown>): DashboardComponentSchema =>
  ({ type: 'dashboard', name: 'ops', widgets: [], ...root }) as unknown as DashboardComponentSchema;

/** The two components under test, each named, so a failure says which one. */
const SURFACES: Array<[string, React.ComponentType<{
  schema: DashboardComponentSchema;
  onRefresh?: () => void;
}>]> = [
  ['DashboardGridLayout', DashboardGridLayout as never],
  ['DashboardRenderer', DashboardRenderer as never],
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Mount `Surface` with `schema`, run `ms` of fake time, report the call count. */
function refreshesWithin(
  Surface: React.ComponentType<{ schema: DashboardComponentSchema; onRefresh?: () => void }>,
  schema: DashboardComponentSchema,
  ms: number,
): number {
  const onRefresh = vi.fn();
  render(<Surface schema={schema} onRefresh={onRefresh} />);
  // Nothing may have fired yet — a timer that ran on mount would be a
  // different bug, and this is the control for it.
  expect(onRefresh, 'refreshed before its first period elapsed').not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  return onRefresh.mock.calls.length;
}

// `_name` only feeds the `%s` in the title — the run output has to say WHICH
// surface failed, since the two cases are otherwise identical.
describe.each(SURFACES)('%s — the auto-refresh timer fires (objectui#8820)', (_name, Surface) => {
  it('starts from the spec-canonical `refreshIntervalSeconds`', () => {
    // 30s period, 95s of time → three firings. Asserting the COUNT and not
    // merely "was called" is what separates a running interval from a
    // one-shot: a `setTimeout` mistaken for a `setInterval` returns 1 here.
    expect(refreshesWithin(Surface, dash({ refreshIntervalSeconds: 30 }), 95_000)).toBe(3);
  });

  it('still starts from the legacy `refreshInterval` — the migration window', () => {
    expect(refreshesWithin(Surface, dash({ refreshInterval: 30 }), 95_000)).toBe(3);
  });

  it('does not start when no period is authored', () => {
    expect(refreshesWithin(Surface, dash({}), 95_000)).toBe(0);
  });

  it('does not start when the author switched it off with `0`', () => {
    expect(refreshesWithin(Surface, dash({ refreshIntervalSeconds: 0 }), 95_000)).toBe(0);
  });

  it('does not start without an `onRefresh` host handler', () => {
    // No handler wired at all: the surface must not throw and must not spin a
    // timer that would call nothing.
    render(<Surface schema={dash({ refreshIntervalSeconds: 30 })} />);
    expect(() => act(() => { vi.advanceTimersByTime(95_000); })).not.toThrow();
  });

  it('stops when the dashboard unmounts — the interval is cleared', () => {
    const onRefresh = vi.fn();
    const view = render(
      <Surface schema={dash({ refreshIntervalSeconds: 30 })} onRefresh={onRefresh} />,
    );
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
    act(() => { vi.advanceTimersByTime(300_000); });
    expect(onRefresh, 'the interval outlived the component').toHaveBeenCalledTimes(1);
  });
});

describe('the two spellings, and which one wins (objectui#8820)', () => {
  it('prefers the new key when a half-migrated document carries both', () => {
    // The realistic half-migrated shape: the new key added, the old one left
    // behind. 60s must win over 30s, so 95s buys exactly one firing.
    expect(
      refreshesWithin(
        DashboardRenderer as never,
        dash({ refreshIntervalSeconds: 60, refreshInterval: 30 }),
        95_000,
      ),
    ).toBe(1);
  });

  it('an explicit `refreshIntervalSeconds: 0` is not overridden by a stale old key', () => {
    // ⭐ The trap a `||` / `??` chain walks into. `0` is an AUTHORED value —
    // "off" is the config panel's first option — so a truthiness-based
    // preference falls THROUGH it to the abandoned `refreshInterval: 30` and
    // starts a timer the author had just switched off. Presence wins, not
    // truthiness.
    expect(
      refreshesWithin(
        DashboardRenderer as never,
        dash({ refreshIntervalSeconds: 0, refreshInterval: 30 }),
        95_000,
      ),
    ).toBe(0);
    expect(resolveRefreshIntervalSeconds(dash({ refreshIntervalSeconds: 0, refreshInterval: 30 })))
      .toBe(0);
  });

  it('reads only real numbers — the string dialect the manifest already refuses', () => {
    // `'30'` draws `type-mismatch` from the published manifest
    // (`dashboardAuthoredInputs.test.tsx`), so honouring it here would be the
    // second, looser contract AGENTS.md #0.1 rules out. The old inline gate
    // (`!x || x <= 0`) coerced it; this does not.
    expect(resolveRefreshIntervalSeconds(dash({ refreshIntervalSeconds: '30' }))).toBeUndefined();
    expect(resolveRefreshIntervalSeconds(dash({ refreshIntervalSeconds: Number.NaN })))
      .toBeUndefined();
  });

  it('reports no period when the dashboard declares neither key', () => {
    expect(resolveRefreshIntervalSeconds(dash({}))).toBeUndefined();
  });
});
