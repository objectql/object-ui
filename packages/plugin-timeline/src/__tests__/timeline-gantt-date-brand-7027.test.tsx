/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7027 — the gantt date TYPE GATE is made total, and the totality is
 * EXERCISED rather than asserted.
 *
 * ## Why this file exists at all, and why it is the deliverable
 *
 * Four cards have now made a totality claim about this one code path, and each
 * of the first three was falsified by the next one's MEASUREMENT:
 *
 *   1. #6759 declared `spellGanttDateValue` "total by construction".
 *   2. #6905 (#6781's type rule) made that property load-bearing by ordering
 *      the type gate BEFORE `new Date`.
 *   3. #6907 (PR #7026) measured that the speller was NOT total — `String`
 *      ran author `toString`, and three inputs crashed the render on `main`.
 *      The gate had not removed the crash class; it moved it downstream.
 *   4. This card: the GATE has a gap of the same kind, one function upstream.
 *      `value instanceof Date` answers "does this inherit from
 *      `Date.prototype`", not "is this a Date", and the two differ.
 *
 * A fifth prose assertion would continue the sequence. What ends it is a
 * PINNED ADVERSARIAL INPUT SET — every way the language lets an object lie
 * about being a Date, each one asserted to reach a DEFINED outcome. That is
 * what #7026 gave the speller and what the gate did not have.
 *
 * ## What "a defined outcome" means here — two kinds, and never a third
 *
 * ⚠️ Not every row below is a refusal, and forcing them all to be one would
 * change the accept set, which is #6781's ruling and is untouched by this card.
 * Every input reaches exactly one of:
 *
 *   - ACCEPTED  — it is a real Date, so the chart draws (rows 5 and 6 below).
 *   - NAMED     — it is refused through #6759/#6770/#6781's single existing
 *                 diagnostic, with the authored path and a spelling.
 *
 * and never the third, which is what this card removes:
 *
 *   - THREW     — an uncaught TypeError mid-render, i.e. a blank screen where
 *                 a named diagnostic belongs.
 *
 * ## The base readings — measured on 7fc5c3c12, node probe + this suite
 *
 *     Object.create(Date.prototype)              -> THREW TypeError: Method
 *         Date.prototype.toString called on incompatible receiver
 *         [object Object]                        (in `isUnusable`, and again
 *                                                 in `spellGanttDateValue`)
 *     new Proxy(Object.create(Date.prototype),
 *               { get() { throw } })             -> THREW  (the get trap, via
 *                                                 ToPrimitive in `new Date`)
 *     new Proxy({}, { getPrototypeOf() { throw } })
 *                                                -> THREW  (`instanceof`
 *                                                 itself is not total)
 *     class X extends Date { getTime() { throw } }
 *                                                -> accepted, chart drew (the
 *                                                 CONTROL that rejects one of
 *                                                 the two suggested repairs)
 *     { get [Symbol.toStringTag]() { throw } }   -> named "an object" (the
 *                                                 CONTROL that rejects the
 *                                                 other suggested repair)
 *     new Proxy({}, { get() { throw } })         -> named "an object"
 *     new Date('2024-01-01')                     -> accepted, chart drew
 *     new Date(NaN)                              -> named "Invalid Date"
 *
 * The three THREW rows are the defect. The two CONTROL rows are the reason the
 * repair is neither of the two the card suggested — see pin 2.
 *
 * ## Assertions count BAR ELEMENTS, never styles
 *
 * #6759's rule, inherited through #6770 and #6781: a bar whose geometry is
 * `NaN` carries NO `style` attribute at all, so an assertion phrased over
 * styles reads identically for "the bar is gone" and "the bar is there and
 * broken". Refusal assertions are positive about the diagnostic and count
 * elements; styles are read only where an UNCHANGED geometry is the point.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimelineRenderer } from '../renderer';

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

const TESTID = 'timeline-unusable-date-range';
const PATH = 'items[0].items[0].endDate';

/** The axis header cells the gantt branch emits, in order. */
const axisOf = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.border-r.text-xs.font-medium.text-center')).map(
    (n) => n.textContent ?? '',
  );

/** How many bar ELEMENTS exist — not their geometry. See the header. */
const barCountOf = (container: HTMLElement): number =>
  container.querySelectorAll('.absolute.h-8.rounded-md').length;

/** The diagnostic's text, or `null` when the gantt rendered instead. */
const diagnosticOf = (container: HTMLElement): string | null => {
  const el = container.querySelector(`[data-testid="${TESTID}"]`);
  return el ? el.textContent ?? '' : null;
};

const gantt = (schema: Record<string, unknown>) =>
  render(<TimelineRenderer schema={{ type: 'timeline', variant: 'gantt', ...schema } as any} />);

/** One row carrying one item, so a case only has to say what is wrong with it. */
const rowWith = (item: Record<string, unknown>) => [{ label: 'R', items: [{ title: 'T', ...item }] }];

/**
 * The adversarial constructors, as FACTORIES.
 *
 * Each is built fresh per case on purpose: several of these are single-use
 * (a revoked proxy, a getter that throws) and a shared instance would let one
 * case's first touch decide another case's reading.
 */

/** Inherits `Date.prototype`, owns no `[[DateValue]]` slot. The filed defect. */
const slotlessImpostor = () => Object.create(Date.prototype) as unknown;

/** The same impostor, behind a proxy that also refuses every property read. */
const hostileSlotlessImpostor = () =>
  new Proxy(Object.create(Date.prototype), {
    get() {
      throw new Error('get trap: no property of this value may be read');
    },
  }) as unknown;

/** Breaks `instanceof` ITSELF — `instanceof` walks `[[GetPrototypeOf]]`. */
const prototypeHostileProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('getPrototypeOf trap: this value has no readable prototype');
      },
    },
  ) as unknown;

/** Refuses every property read, but is honest about its prototype. */
const readHostileProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('get trap: no property of this value may be read');
      },
    },
  ) as unknown;

/** A REAL Date (it owns its slot) whose `getTime` is hijacked to throw. */
class HijackedGetTime extends Date {
  override getTime(): number {
    throw new Error('getTime hijacked by the authored document');
  }
}

/** An object whose `Symbol.toStringTag` is a throwing getter. */
const throwingToStringTag = () =>
  ({
    get [Symbol.toStringTag](): string {
      throw new Error('Symbol.toStringTag getter throws');
    },
  }) as unknown;

describe('pin 1 — a Date IMPOSTOR is NAMED, never thrown (objectui#7027)', () => {
  /**
   * The defect, in its three measured spellings. Every one of these passed
   * `value instanceof Date` (or crashed inside it) on 7fc5c3c12 and took the
   * render down with an uncaught `TypeError`.
   *
   * The assertion is deliberately about the DIAGNOSTIC and not about the
   * absence of a throw: `render` propagates a render-time error, so a
   * regression here fails loudly on the first line rather than on a
   * `not.toThrow` that would also pass for a silently-drawn wrong chart.
   */
  const impostors: [string, () => unknown][] = [
    [
      'Object.create(Date.prototype) — inherits the prototype, owns no [[DateValue]] slot',
      slotlessImpostor,
    ],
    [
      'the same impostor behind a Proxy that throws on every get',
      hostileSlotlessImpostor,
    ],
    [
      'a Proxy whose getPrototypeOf trap throws — `instanceof` is not total either',
      prototypeHostileProxy,
    ],
  ];

  for (const [label, make] of impostors) {
    it(`names ${label}`, () => {
      const { container } = gantt({ items: rowWith({ startDate: '2024-01-01', endDate: make() }) });

      const el = screen.getByTestId(TESTID);
      // The same channel #6759/#6770/#6781 use. No second diagnostic, no new
      // i18n key — an impostor is refused as the non-date it is.
      expect(el.getAttribute('role')).toBe('alert');
      const text = el.textContent ?? '';
      expect(text, 'the diagnostic did not name the authored path').toContain(PATH);
      // Named by TYPE, never rendered: producing text from an impostor is the
      // one operation that hands control back to the authored document.
      expect(text, 'the impostor was rendered instead of named').toContain('is an object');
      // No chart was drawn from a value that is not a date.
      expect(axisOf(container), 'a chart was drawn from a Date impostor').toEqual([]);
      expect(barCountOf(container)).toBe(0);
      expect(screen.queryByText('T')).toBeNull();
    });
  }

  it('a Proxy that throws on every get is named, not thrown', () => {
    // Refused on the base too (its prototype is `Object.prototype`), so this
    // row is a REGRESSION pin rather than a repair: the gate's new brand test
    // must not start reading properties off the value.
    const { container } = gantt({
      items: rowWith({ startDate: '2024-01-01', endDate: readHostileProxy() }),
    });

    const text = diagnosticOf(container) ?? '';
    expect(text).toContain(PATH);
    expect(text).toContain('is an object');
    expect(barCountOf(container)).toBe(0);
  });
});

describe('pin 2 — the two SUGGESTED repairs, each with the input that refutes it (objectui#7027)', () => {
  /**
   * The card offered two brand tests and triage flagged both as "not free".
   * These two rows are why neither was taken, and they are the rows that go
   * red if a later reader "simplifies" the gate into one of them.
   */

  it('a Date subclass whose `getTime` throws is ACCEPTED — refutes `Number.isFinite(value.getTime())`', () => {
    // It is a REAL Date: `super()` gave it a `[[DateValue]]` slot, so it is
    // inside #6781's accept set and the chart must draw. A gate written as
    // `Number.isFinite(value.getTime())` would call the AUTHOR's `getTime` and
    // die here — trading the impostor crash for a subclass crash.
    //
    // `new Date(x)` never runs ToPrimitive on a value that owns the slot, so
    // the hijack is unreachable from the guard as written.
    const { container } = gantt({
      items: rowWith({ startDate: '2024-01-01', endDate: new HijackedGetTime('2024-03-01') }),
    });

    expect(diagnosticOf(container), 'a real Date subclass was refused').toBeNull();
    expect(barCountOf(container), 'the chart did not draw for a real Date').toBe(1);
    expect(axisOf(container)).toEqual(['Jan 2024', 'Feb 2024', 'Mar 2024']);
  });

  it('an object with a throwing `Symbol.toStringTag` getter is NAMED — refutes `Object.prototype.toString.call`', () => {
    // `Object.prototype.toString` always performs `Get(O, @@toStringTag)`
    // (ES2015 step 16) even when the builtin tag is already decided, so the
    // brand test runs this getter and throws. Measured — the same fact #6907
    // recorded when it refused that spelling inside `spellGanttDateValue`.
    const { container } = gantt({
      items: rowWith({ startDate: '2024-01-01', endDate: throwingToStringTag() }),
    });

    const text = diagnosticOf(container) ?? '';
    expect(text).toContain(PATH);
    expect(text).toContain('is an object');
    expect(barCountOf(container)).toBe(0);
  });
});

describe('pin 3 — the ACCEPT SET is unchanged: #6781’s ruling does not move (objectui#7027)', () => {
  /**
   * This card repairs a CRASH; it adjudicates nothing. Every value an author
   * can write must land exactly where #6781 put it. These are the controls.
   */

  it('a real, valid `Date` still draws its chart', () => {
    const { container } = gantt({
      items: rowWith({ startDate: '2024-01-01', endDate: new Date('2024-03-01') }),
    });

    expect(diagnosticOf(container), 'a real Date was refused').toBeNull();
    expect(barCountOf(container)).toBe(1);
    expect(axisOf(container)).toEqual(['Jan 2024', 'Feb 2024', 'Mar 2024']);
  });

  it('`new Date(NaN)` is still refused by the PARSE check, and still spelled `Invalid Date`', () => {
    // The load-bearing half of "do not change the accept set": an invalid Date
    // owns its slot, so it must pass the TYPE gate and be refused one step
    // later. A brand test that refused it would move the diagnostic's spelling
    // from `Invalid Date` to `an object` — a visible change to an author.
    const { container } = gantt({
      items: rowWith({ startDate: '2024-01-01', endDate: new Date(Number.NaN) }),
    });

    const text = diagnosticOf(container) ?? '';
    expect(text).toContain(PATH);
    expect(text, 'the invalid Date lost its `Invalid Date` spelling').toContain('Invalid Date');
    expect(barCountOf(container)).toBe(0);
  });

  it('the three accepted spellings and the three refused ones are all where #6781 left them', () => {
    // A compact re-assertion across the accept-set boundary, so this file fails
    // if the brand test is ever widened or narrowed past the crash class.
    const accepted: [string, unknown][] = [
      ['a date string', '2024-03-01'],
      ['a finite number (epoch ms)', 1709251200000],
      ['a real Date', new Date('2024-03-01')],
    ];
    for (const [label, value] of accepted) {
      const { container } = gantt({ items: rowWith({ startDate: '2024-01-01', endDate: value }) });
      expect(diagnosticOf(container), `${label} was refused`).toBeNull();
      expect(barCountOf(container), `${label} drew no bar`).toBe(1);
    }

    const refused: [string, unknown][] = [
      ['null', null],
      ['undefined', undefined],
      ['a boolean', false],
    ];
    for (const [label, value] of refused) {
      const { container } = gantt({ items: rowWith({ startDate: '2024-01-01', endDate: value }) });
      expect(diagnosticOf(container) ?? '', `${label} was accepted`).toContain(PATH);
      expect(barCountOf(container), `${label} drew a bar`).toBe(0);
    }
  });
});
