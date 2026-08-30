/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pins the drawer width a calendar gets when it declares no `navigation`
 * (objectui#6303 — the sibling of `ObjectGantt.navWidthDefault.test.tsx`).
 *
 * `ObjectCalendar` used to spell `min(960px, 60vw)` in TWO places: the
 * `navConfig` default (`{ mode: 'drawer', width: 'min(960px, 60vw)' }`) and,
 * further down, a render-site
 * `width={(navigation.width as any) ?? 'min(960px, 60vw)'}`. The second is why
 * taking only the first would have changed nothing — the old width survived by
 * a different route.
 *
 * `width` is `@deprecated [#2578 -> size]` and `resolveOverlayWidth` gives an
 * explicit `width` priority OVER `size`, so spelling it kept the deprecated
 * branch load-bearing on the path most calendars take. The default is now
 * `{ mode: 'drawer' }` with no render-site fallback: `resolveOverlayWidth`
 * returns `undefined` and RecordDetailDrawer's own `width` default supplies the
 * identical CSS — a zero-pixel change.
 *
 * Both halves below are load-bearing and fail for different reasons:
 *
 *   half 1 — the calendar must stop injecting a width of its own (it has to
 *            hand `undefined` down, or the drawer's default can never apply).
 *            This half is what catches a re-added `??` fallback at the render
 *            site, which half 2 alone cannot see: the fallback's value is the
 *            same string the drawer default produces;
 *   half 2 — the width the REAL drawer then resolves must still be that value.
 *            Without this half the calendar would follow a moved drawer default
 *            invisibly, which is the regression the indirection introduces.
 *
 * A third case pins the other direction: an AUTHORED `navigation.width` still
 * wins. What #6303 removed is the renderer spelling the deprecated key as its
 * own default — not the key's acceptance as an authored value.
 *
 * All three assert the resolved width VALUE — never a `className`, never "it
 * renders", either of which passes in both worlds.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ObjectCalendar } from './ObjectCalendar';

/** The width the calendar's drawer has always resolved to. Must not drift. */
const EXPECTED_WIDTH = 'min(960px, 60vw)';

// Record the props ObjectCalendar hands down, then delegate to the REAL drawer
// so half 2 measures the actual resolution rather than a stub's idea of it.
let drawerProps: any = null;
vi.mock('@object-ui/plugin-detail', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const Real = actual.RecordDetailDrawer;
  return {
    ...actual,
    RecordDetailDrawer: (props: any) => {
      drawerProps = props;
      return <Real {...props} />;
    },
  };
});

/**
 * The month grid renders whatever month `currentDate` is on, and `currentDate`
 * initialises to `new Date()` — so the event has to sit in the CURRENT month or
 * there is nothing on screen to click. Noon avoids a timezone shift moving it
 * across a month boundary.
 */
function eventInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0).toISOString();
}

async function openDrawer(navigation?: Record<string, unknown>) {
  render(
    <ObjectCalendar
      schema={{
        type: 'object-calendar',
        objectName: 'events',
        calendar: { startDateField: 'starts_at', titleField: 'name' },
        data: {
          provider: 'value',
          items: [{ id: '1', name: 'On the calendar', starts_at: eventInCurrentMonth() }],
        },
        ...(navigation ? { navigation } : {}),
      } as never}
    />,
  );
  const event = await screen.findByText('On the calendar');
  fireEvent.click(event);
  await waitFor(() => expect(drawerProps).not.toBeNull());
  await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
}

/**
 * The drawer prefers a drag-resized width persisted in localStorage over its
 * prop, which would mask half 2 — and it is keyed by `objectName`, so a value
 * left by any earlier test in the file would be read back here.
 */
function readPanelWidth(): string {
  const panel = document.querySelector('[role="dialog"]') as HTMLElement | null;
  expect(panel, 'drawer panel').not.toBeNull();
  // The drawer applies the resolved width as an inline style on its panel, as
  // BOTH `width` and `max-width`. happy-dom's CSS parser drops the `width`
  // longhand when the value is a `min()` expression but keeps `max-width`, so
  // the surviving declaration is what we read — it is the same resolved
  // string, not a proxy for it.
  return panel!.style.maxWidth;
}

describe('calendar drawer width with no declared `navigation` (objectui#6303)', () => {
  beforeEach(() => {
    drawerProps = null;
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => cleanup());

  it('half 1: the calendar injects no width of its own (so the drawer default applies)', async () => {
    await openDrawer();
    expect(drawerProps.width).toBeUndefined();
  });

  it('half 2: the width the real drawer resolves is still the pinned value', async () => {
    await openDrawer();
    expect(readPanelWidth()).toBe(EXPECTED_WIDTH);
  });

  it('an authored `navigation.width` still reaches the drawer unchanged', async () => {
    await openDrawer({ mode: 'drawer', width: '720px' });
    expect(drawerProps.width).toBe('720px');
    expect(readPanelWidth()).toBe('720px');
  });
});
