/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6750 — a gantt timeline with an EMPTY literal `items` array renders
 * a zero-row grid instead of throwing.
 *
 * ## The defect
 *
 * `calculateDateRange` reduced the empty list with no guard: `allDates` is
 * `[]`, `Math.min()` over no arguments is `Infinity`, and
 * `new Date(Infinity).toISOString()` throws `RangeError: Invalid time value`
 * during render. Both entry points crashed identically. Measured on this
 * card's base b76ca6764, with a throwaway probe before any change:
 *
 *     PROBE-A throw: RangeError: Invalid time value   <- TimelineRenderer
 *     PROBE-B throw: RangeError: Invalid time value   <- ObjectTimeline
 *
 * An empty gantt is the ORDINARY empty state of a valid schema, not a
 * malformed document — any generator that builds `items` from a collection
 * emits `items: []` the moment the collection is empty.
 *
 * ## Why three sites, pinned separately
 *
 * Triage (2026-08-29) put the whole branch in scope, because fixing only the
 * one `throw` 「会把崩溃往后推两站」. The three stops, and what each pin below
 * holds:
 *
 *   1. `calculateDateRange` — the throw itself. Now returns a one-day sentinel
 *      range anchored on today.
 *   2. `generateTimeScaleHeaders` — needed no change, and that is a MEASURED
 *      verdict, not an assumption: a degenerate `min === max` range is not
 *      inverted, so it emits exactly one bucket. Pin 5a holds the composition.
 *   3. `calculateBarDimensions` — `totalDuration === 0` divided `0 / 0` into
 *      `NaN`, which the CSSOM rejects, leaving the bar with NO `style`
 *      attribute at all. Pin 5b holds that. Not reachable from the empty case
 *      (no rows means no bars), which is exactly why it needs its own pin.
 *
 * ## What is deliberately NOT here
 *
 * Nothing asserts what an empty gantt should LOOK like. Triage was explicit
 * that 「不要崩」 is a correctness floor while 「崩改成空态面板还是零行图表」 is a
 * product option it withheld. A zero-row grid is what direction 1 produces;
 * substituting the repo's standard empty-state panel would be taking a decision
 * that was left open on purpose.
 *
 * ## Why the real renderer, not a stub
 *
 * `ObjectTimeline.test.tsx` stubs `./renderer`, so every assertion there stays
 * green whether or not the gantt branch was ever reached. The evidence here is
 * markup the real `TimelineRenderer` emits — or, before the fix, the throw it
 * raised. Nothing is mocked except the ambient React context hooks.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectTimeline } from '../ObjectTimeline';
import { TimelineRenderer, generateTimeScaleHeaders } from '../renderer';

vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await (importOriginal() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    useDataScope: () => undefined,
    useNavigationOverlay: () => ({
      isOverlay: false,
      handleClick: vi.fn(),
      selectedRecord: null,
      isOpen: false,
      close: vi.fn(),
      setIsOpen: vi.fn(),
      mode: 'overlay',
      view: undefined,
    }),
    useObjectLabel: () => ({
      fieldOptionLabel: (_o: string, _f: string, _v: string, fb: string) => fb,
      translateOptions: (_o: string, _f: string, opts: unknown[]) => opts,
      fieldLabel: (_o: string, _f: string, fb: string) => fb,
    }),
  };
});

/**
 * The sentinel anchors on "now", so the clock is pinned rather than the
 * assertions being written around whatever day CI happens to run on. Only
 * `Date` is faked: faking timers wholesale interferes with React's scheduler.
 */
const FROZEN_TODAY = '2026-03-15';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${FROZEN_TODAY}T09:30:00.000Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

const EMPTY_GANTT = { type: 'timeline', variant: 'gantt', items: [] };

/** The axis header cells the gantt branch emits, in order. */
const axisOf = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.border-r.text-xs.font-medium.text-center')).map(
    (n) => n.textContent ?? '',
  );

/** Every bar's inline geometry, in order — literally `calculateBarDimensions`'s output. */
const barStylesOf = (container: HTMLElement): (string | null)[] =>
  Array.from(container.querySelectorAll('.absolute.h-8.rounded-md')).map((n) =>
    (n as HTMLElement).getAttribute('style'),
  );

/** Row labels below the header — zero of them is the "zero-row grid". */
const rowLabelsOf = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.px-4.py-2.font-medium.text-sm.truncate')).map(
    (n) => n.textContent ?? '',
  );

describe('pin 1 — `TimelineRenderer` with an empty gantt does not throw (objectui#6750)', () => {
  it('renders instead of raising `RangeError: Invalid time value`', () => {
    // The whole defect in one assertion. Before the guard this call throws out
    // of `calculateDateRange`.
    expect(() => render(<TimelineRenderer schema={EMPTY_GANTT as any} />)).not.toThrow();
  });

  it('renders a zero-row grid — the gantt chrome is there, the rows are not', () => {
    const { container } = render(<TimelineRenderer schema={EMPTY_GANTT as any} />);

    // Chrome: the row-label header the gantt branch always emits.
    expect(screen.getByText('Items')).toBeDefined();
    // Zero rows, and therefore zero bars.
    expect(rowLabelsOf(container), 'an empty gantt drew rows').toEqual([]);
    expect(barStylesOf(container), 'an empty gantt drew bars').toEqual([]);
  });

  it('the axis is VALID, not an empty header row', () => {
    const { container } = render(<TimelineRenderer schema={EMPTY_GANTT as any} />);

    // A header row with zero cells would also "not throw"; that is not what
    // was asked for. The sentinel is one day, so every scale yields exactly
    // one bucket — here the default `month`, on the frozen clock.
    expect(axisOf(container)).toEqual(['Mar 2026']);
  });

  it('every spec scale yields a one-bucket axis on the sentinel range', () => {
    // Guards against a sentinel that happens to work for `month` and collapses
    // to zero columns on another axis.
    for (const [scale, expected] of [
      ['hour', 'Mar 15, 12 AM'],
      ['day', 'Mar 15'],
      ['week', 'Week 1'],
      ['month', 'Mar 2026'],
      ['quarter', 'Q1 2026'],
      ['year', '2026'],
    ] as const) {
      const { container, unmount } = render(
        <TimelineRenderer schema={{ ...EMPTY_GANTT, scale } as any} />,
      );
      expect(axisOf(container), `empty gantt on scale '${scale}' drew no axis`).toEqual([expected]);
      unmount();
    }
  });
});

describe('pin 2 — `ObjectTimeline` with the same schema does not throw (objectui#6750)', () => {
  it('passes the AUTHORED empty array straight through and renders it', () => {
    // An authored empty array is truthy, so `effectiveItems` returns it as
    // authored items — this is not the composed path, and #6655's refusal
    // (which keys on whether items were authored) correctly does not fire.
    expect(() => render(<ObjectTimeline schema={EMPTY_GANTT as any} />)).not.toThrow();
  });

  it('produces the same zero-row grid as the renderer', () => {
    const { container } = render(<ObjectTimeline schema={EMPTY_GANTT as any} />);

    expect(screen.getByText('Items')).toBeDefined();
    expect(axisOf(container)).toEqual(['Mar 2026']);
    expect(rowLabelsOf(container)).toEqual([]);
    expect(barStylesOf(container)).toEqual([]);
    // #6655's diagnostic belongs to the COMPOSED path and must stay away.
    expect(
      screen.queryByTestId('timeline-unsupported-variant'),
      "#6655's refusal fired on an authored empty gantt",
    ).toBeNull();
  });
});

describe('pin 3 — an author-pinned range survives the sentinel (objectui#6750)', () => {
  it('`minDate` / `maxDate` with `items: []` renders EXACTLY that range, with no rows', () => {
    // Triage kept this argument for direction 1 because it is a free win: the
    // gantt branch resolves `schema.minDate || dateRange.minDate`, so the
    // sentinel is only ever a fallback. An author who pinned a quarter gets
    // that quarter, empty — most likely what they wanted.
    const { container } = render(
      <TimelineRenderer
        schema={{ ...EMPTY_GANTT, minDate: '2024-01-01', maxDate: '2024-03-31' } as any}
      />,
    );

    expect(axisOf(container), 'the sentinel clobbered an author-pinned range').toEqual([
      'Jan 2024',
      'Feb 2024',
      'Mar 2024',
    ]);
    expect(rowLabelsOf(container)).toEqual([]);
    expect(barStylesOf(container)).toEqual([]);
  });
});

/**
 * The catalog fixture's shape, trimmed. Its rendered output below is the
 * BASELINE captured on b76ca6764 before any change — this pin is what catches a
 * sentinel or a degenerate-range guard leaking into the normal path.
 */
const GANTT_ROWS = [
  {
    label: 'Backend Development',
    items: [
      { title: 'API Design', startDate: '2024-01-01', endDate: '2024-01-31', variant: 'success' },
      { title: 'Implementation', startDate: '2024-02-01', endDate: '2024-03-31', variant: 'info' },
    ],
  },
  {
    label: 'Frontend Development',
    items: [
      { title: 'UI Design', startDate: '2024-01-15', endDate: '2024-02-15', variant: 'warning' },
    ],
  },
];

describe('pin 4 — a NON-empty gantt is byte-for-byte unchanged (objectui#6750)', () => {
  it('draws the same axis and the same bar geometry as before the guards', () => {
    const { container } = render(
      <TimelineRenderer
        schema={{ type: 'timeline', variant: 'gantt', scale: 'month', items: GANTT_ROWS } as any}
      />,
    );

    // Captured on b76ca6764 with the pre-fix code:
    //   PROBE-C axis: ["Jan 2024","Feb 2024","Mar 2024"]
    expect(axisOf(container)).toEqual(['Jan 2024', 'Feb 2024', 'Mar 2024']);

    // Captured on b76ca6764 with the pre-fix code:
    //   PROBE-C bars: ["left: 0%; width: 33.33333333333333%;",
    //                  "left: 34.44444444444444%; width: 65.55555555555556%;",
    //                  "left: 15.555555555555555%; width: 34.44444444444444%;"]
    // The full float spelling on purpose: a guard that rounded, clamped or
    // short-circuited the normal arithmetic would still pass a tolerance
    // assertion and fail this one.
    expect(barStylesOf(container)).toEqual([
      'left: 0%; width: 33.33333333333333%;',
      'left: 34.44444444444444%; width: 65.55555555555556%;',
      'left: 15.555555555555555%; width: 34.44444444444444%;',
    ]);

    expect(rowLabelsOf(container)).toEqual(['Backend Development', 'Frontend Development']);
  });
});

describe('pin 5a — `generateTimeScaleHeaders` on the degenerate range (objectui#6750)', () => {
  it('a `min === max` range is not inverted, so every scale emits exactly one bucket', () => {
    // The site itself, called directly — this is the guarantee the empty
    // gantt's axis rests on, and it is pinned SEPARATELY from the sentinel so
    // that a later change to either one alone goes red here.
    for (const [scale, expected] of [
      ['hour', 'Mar 15, 12 AM'],
      ['day', 'Mar 15'],
      ['week', 'Week 1'],
      ['month', 'Mar 2026'],
      ['quarter', 'Q1 2026'],
      ['year', '2026'],
    ] as const) {
      expect(
        generateTimeScaleHeaders(scale, FROZEN_TODAY, FROZEN_TODAY),
        `scale '${scale}' drew no axis on a degenerate range`,
      ).toEqual([expected]);
    }
  });

  it('still refuses an unparseable or inverted range by drawing nothing', () => {
    // The pre-existing guard, pinned so the #6750 work is not read as having
    // widened it. An inverted author-pinned range is a different input class
    // and is left exactly as it was.
    expect(generateTimeScaleHeaders('month', '2030-01-01', '2026-03-15')).toEqual([]);
    expect(generateTimeScaleHeaders('month', '', '')).toEqual([]);
  });
});

describe('pin 5b — `calculateBarDimensions` on a degenerate axis (objectui#6750)', () => {
  it('a same-day task gets a real bar instead of `NaN` geometry', () => {
    // `totalDuration === 0`, so both divisions were `0 / 0`. Measured on
    // b76ca6764: the bar element carried NO `style` attribute at all, because
    // the CSSOM rejects `left: NaN%` and `width: NaN%` — an invisible failure,
    // not a crash. This case is NOT reachable from the empty gantt (no rows
    // means no bars), which is why it has its own pin.
    const SAME_DAY = [
      { label: 'One Day', items: [{ title: 'Kickoff', startDate: '2024-05-01', endDate: '2024-05-01' }] },
    ];
    const { container } = render(
      <TimelineRenderer schema={{ type: 'timeline', variant: 'gantt', items: SAME_DAY } as any} />,
    );

    expect(barStylesOf(container)).toEqual(['left: 0%; width: 100%;']);
    // The axis is still real, and still one bucket wide.
    expect(axisOf(container)).toEqual(['May 2024']);
  });

  it('an author pinning `minDate === maxDate` reaches the same guard', () => {
    // The second way to a zero-width axis, and the one an author can trip
    // without any same-day task: the pinned range wins at the call site, so
    // `calculateBarDimensions` gets `totalDuration === 0` even though the rows
    // span a real interval.
    const { container } = render(
      <TimelineRenderer
        schema={
          {
            type: 'timeline',
            variant: 'gantt',
            items: [GANTT_ROWS[1]],
            minDate: '2024-02-01',
            maxDate: '2024-02-01',
          } as any
        }
      />,
    );

    expect(barStylesOf(container)).toEqual(['left: 0%; width: 100%;']);
  });
});

describe("pin 6 — #6655's object-bound refusal is undisturbed (objectui#6750)", () => {
  /** Records, not items — what the OBJECT-BOUND path composes from. */
  const rows = [
    { id: '1', name: 'Spring Launch', start_date: '2099-09-01', end_date: '2099-09-30' },
    { id: '2', name: 'Summer Push', start_date: '2100-10-01', end_date: '2100-10-31' },
  ];
  const OBJECT_BOUND = {
    type: 'timeline',
    objectName: 'campaign',
    variant: 'gantt',
    timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
  };

  it('a COMPOSED gantt still refuses loudly — the sentinel did not swallow it', () => {
    // The hazard this pin exists for: a guard that returns a sentinel range for
    // ANY empty date list would make the object-bound path render a silent
    // empty chart instead of #6655's diagnostic, quietly undoing that ruling.
    // The refusal fires in `ObjectTimeline`, above the renderer, and keys on
    // whether items were AUTHORED — so it is reached before any of this card's
    // code, and #6750 leaves it untouched.
    const props = { schema: OBJECT_BOUND, data: rows } as unknown as React.ComponentProps<
      typeof ObjectTimeline
    >;
    const { container } = render(<ObjectTimeline {...props} />);

    const el = screen.queryByTestId('timeline-unsupported-variant');
    expect(el, "#6655's refusal stopped firing on the composed gantt path").not.toBeNull();
    expect(el!.getAttribute('role')).toBe('alert');
    expect(el!.textContent ?? '').toContain('gantt');

    // And no gantt was drawn in its place.
    expect(axisOf(container)).toEqual([]);
    expect(barStylesOf(container)).toEqual([]);
    expect(screen.queryByText('Spring Launch')).toBeNull();
  });
});
