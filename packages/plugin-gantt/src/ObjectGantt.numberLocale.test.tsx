/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4553 — the gantt tooltip's NUMERIC rows rendered outside the
 * display-locale channel, next to date rows that follow it.
 *
 * `formatFieldValue` (the tooltip value formatter inside ObjectGantt's `tasks`
 * memo) had its four TEMPORAL call sites threaded with `useDisplayLocale()` by
 * objectui#4272 / PR #4544. The three numeric ones beside them passed no
 * locale:
 *
 *     case 'number': ... return formatNumber(Number(value));
 *     case 'currency': return formatCurrency(Number(value), resolveFieldCurrency(def, tenantCurrency));
 *     case 'percent':  return formatPercent(Number(value));
 *
 * One tooltip, two conventions: a `de` session read `5. Jan. 2024` on the date
 * row and `1,234.50` on the amount row, where the German convention is
 * `1.234,50`. The separators are INVERTED, so the amount is not merely
 * unstyled — it reads as a different number.
 *
 * ── The card's premise held for two of the three formatters, not three ───
 * Measured against `@object-ui/fields` before writing any fix (the signature
 * measurement objectui#4553's ruling required):
 *
 *   - `formatNumber(value, decimals = 2, locale?)`   → locale is parameter 3 ✔
 *   - `formatCurrency(value, currency?, locale?)`    → locale is parameter 3 ✔
 *   - `formatPercent(value, precision = 0)`          → NO locale parameter ✘
 *
 * `formatPercent` is `${percentDisplayValue(value).toFixed(precision)}%`. It
 * never constructs an `Intl.NumberFormat` and never reaches
 * `formatDisplayNumber`, so — unlike the other two — it does not render in the
 * MACHINE's locale. It renders in NO locale: `toFixed` always emits an ASCII
 * `.` and never a grouping separator, on every machine. Threading a locale
 * into it is therefore not a call-site change at all; it needs a new parameter
 * on a `@object-ui/fields` export, which this card's surface excludes. The
 * percent case below pins the CURRENT behavior as evidence of that inversion —
 * it is not an endorsement of it, and it is expected to go red on the day
 * `formatPercent` grows a locale.
 *
 * ── Harness (objectui#4542 / PR #4554's lessons) ─────────────────────────
 * `getGanttConfig` returns a FRESH object literal on the flattened top-level
 * path but `schema.gantt` BY REFERENCE on the metadata path, so these cases use
 * a module-constant `schema.gantt` and a module-constant `dataSource` — the
 * identity a metadata-sourced schema actually has. The session config carries a
 * LOCALE ONLY (the currency under test is declared on the field), so nothing
 * re-runs the memo through the currency channel and the locale is what these
 * cases measure.
 *
 * Provider-mounting file (objectui#4514's structural split) — the pure-function
 * halves of this family live in `packages/fields/src/__tests__`.
 *
 * ── Directions, predicted in writing BEFORE the run, then measured ───────
 * Runner: node v22.22.2 / ICU 78.2 / machine locale en-US.
 *
 *   de number   `1,234.50`  → `1.234,50`     RED before, green after
 *   de currency `EUR1,234.50` → `1.234,50 EUR` RED before, green after
 *                             (symbol moves to the END as well as the
 *                              separators inverting — doubly un-fakeable)
 *   de percent  `1235%`     → `1235%`        GREEN BOTH SIDES — the inverted
 *                                            premise, pinned as evidence
 *   en number / currency / percent           GREEN BOTH SIDES — PINS. `en` and
 *                                            the runner's `en-US` coincide, so
 *                                            these assert byte-identical
 *                                            English output, NOT that the fix
 *                                            works.
 *
 * Every expectation spells its tag ('en' / 'de') explicitly; none is built from
 * the runner (objectui#4513).
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { I18nProvider, LocalizationProvider } from '@object-ui/i18n';
import { ObjectGantt } from './ObjectGantt';
import type { DataSource } from '@object-ui/types';

// Same GanttView stub idiom as ObjectGantt.dateLocale.test.tsx /
// ObjectGantt.currencyDep.test.tsx: tooltip rows are surfaced as
// `gv-field-<id>-<i>` handles so their formatted text is assertable without
// rendering the real timeline.
vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => (
    <div data-testid="gantt-view">
      {tasks.map((t: any) => (
        <div key={t.id} data-testid="gantt-task">
          <span>{t.title}</span>
          {t.fields ? (
            <div data-testid={`gv-fields-${t.id}`}>
              {t.fields.map((f: any, i: number) => (
                <span key={i} data-testid={`gv-field-${t.id}-${i}`}>{f.label}={f.value}</span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  ),
}));

/**
 * `1234.5` is the card's own repro value and it discriminates in all three
 * rows at once: four significant digits force a GROUPING separator and the
 * fraction forces a DECIMAL separator, and `de` inverts both. A whole number
 * would exercise neither `formatCurrency`'s fractional width nor the decimal
 * mark, and a value below 1000 would not show grouping at all.
 *
 * `due_date` rides along as objectui#4272 / PR #4544's date row: it is what
 * makes "one tooltip, two conventions" assertable in a single tooltip rather
 * than argued in prose.
 */
const ROWS = [
  {
    id: '1',
    name: 'Task 1',
    start_date: '2024-01-01',
    end_date: '2024-01-10',
    qty: 1234.5,
    amount: 1234.5,
    ratio: 1234.5,
    due_date: '2024-01-05',
  },
];

/**
 * `amount` declares its OWN currency code, so `resolveFieldCurrency` never
 * consults the tenant default and the session config can stay locale-only —
 * the isolation PR #4554 measured (a session that sets both channels re-runs
 * this memo through the currency dep, which would mask what is being tested).
 */
const OBJECT_SCHEMA = {
  fields: {
    name: { type: 'text' },
    start_date: { type: 'date' },
    end_date: { type: 'date' },
    qty: { type: 'number', label: 'Qty' },
    amount: { type: 'currency', label: 'Amount', currency: 'EUR' },
    ratio: { type: 'percent', label: 'Ratio' },
    due_date: { type: 'date', label: 'Due' },
  },
};

// Module-constant: stable identity across re-renders — see the harness note.
const DATA_SOURCE: DataSource = {
  find: vi.fn().mockResolvedValue({ data: ROWS }),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue(OBJECT_SCHEMA),
} as any;

// `schema.gantt` is handed back BY REFERENCE by `getGanttConfig` on this path.
const SCHEMA: any = {
  type: 'gantt',
  gantt: {
    titleField: 'name',
    startDateField: 'start_date',
    endDateField: 'end_date',
    tooltipFields: ['qty', 'amount', 'ratio', 'due_date'],
  },
  data: { provider: 'object', object: 'tasks' },
};

/** Tooltip row handles, in `tooltipFields` order. */
const QTY = 'gv-field-1-0';
const AMOUNT = 'gv-field-1-1';
const RATIO = 'gv-field-1-2';
const DUE = 'gv-field-1-3';

/**
 * A session: the UI language the user picked plus the tenant's regional
 * default. `useDisplayLocale()` resolves tenant regional default → active UI
 * language → 'en'.
 */
function renderSession(language: string, tenantLocale?: string) {
  return render(
    <I18nProvider
      config={{ defaultLanguage: language, detectBrowserLanguage: false }}
      persistLanguage={false}
    >
      <LocalizationProvider value={{ locale: tenantLocale }}>
        <ObjectGantt schema={SCHEMA} dataSource={DATA_SOURCE} />
      </LocalizationProvider>
    </I18nProvider>,
  );
}

/**
 * German puts a NO-BREAK SPACE (U+00A0) between the amount and the currency
 * sign, and the sign itself is U+20AC. Written as escapes rather than pasted
 * so the expectation is readable and greppable in both spellings.
 */
const NBSP = '\u00a0';
const EURO = '\u20ac';

afterEach(() => cleanup());

describe('ObjectGantt tooltips — numeric values follow the display locale (objectui#4553)', () => {
  /**
   * THE RED CASE. Pre-fix both rows render through `Intl` with an `undefined`
   * tag — the MACHINE's locale, which on this runner is en-US — so a German
   * session read `1,234.50`: the grouping and decimal separators inverted
   * against the convention, i.e. a different number, not merely a different
   * style.
   */
  it('de session renders German grouping and decimal separators', async () => {
    renderSession('de');
    await waitFor(() => expect(screen.getByTestId('gv-fields-1')).toBeDefined());

    expect(screen.getByTestId(QTY).textContent).toBe('Qty=1.234,50');
    expect(screen.getByTestId(AMOUNT).textContent).toBe(`Amount=1.234,50${NBSP}${EURO}`);
  });

  /**
   * The card's actual complaint, asserted as ONE tooltip: the date row and the
   * amount row now speak the same convention. Pre-fix the date row was already
   * German (PR #4544) while the amount row beside it was not.
   */
  it('the date row and the numeric rows agree on one convention', async () => {
    renderSession('de');
    await waitFor(() => expect(screen.getByTestId('gv-fields-1')).toBeDefined());

    expect(screen.getByTestId(DUE).textContent).toBe('Due=5. Jan. 2024');
    expect(screen.getByTestId(QTY).textContent).toBe('Qty=1.234,50');
  });

  /**
   * `useDisplayLocale()` ranks the TENANT's configured regional default above
   * the active UI language, exactly as PR #4544 pinned for the date rows. Red
   * before the fix for the same reason as the case above.
   */
  it('an explicit tenant locale outranks the active UI language', async () => {
    renderSession('en', 'de');
    await waitFor(() => expect(screen.getByTestId('gv-fields-1')).toBeDefined());

    // CURRENCY asserted first here, deliberately: a failing `expect` aborts its
    // test, so with the number row asserted first in every case the currency
    // site would never report its own red and would ride on the number site's
    // evidence. This ordering makes the two call sites independently red.
    expect(screen.getByTestId(AMOUNT).textContent).toBe(`Amount=1.234,50${NBSP}${EURO}`);
    expect(screen.getByTestId(QTY).textContent).toBe('Qty=1.234,50');
  });

  /**
   * PIN, green on both sides: the runner's machine locale is en-US and `en`
   * agrees with it here, so this asserts the English output is BYTE-IDENTICAL
   * across the change. It is not evidence that the fix works.
   */
  it('en session output is byte-identical (must-not-change)', async () => {
    renderSession('en');
    await waitFor(() => expect(screen.getByTestId('gv-fields-1')).toBeDefined());

    expect(screen.getByTestId(QTY).textContent).toBe('Qty=1,234.50');
    expect(screen.getByTestId(AMOUNT).textContent).toBe(`Amount=${EURO}1,234.50`);
    expect(screen.getByTestId(RATIO).textContent).toBe('Ratio=1235%');
    expect(screen.getByTestId(DUE).textContent).toBe('Due=Jan 5, 2024');
  });

  /**
   * PIN, green on both sides — and the card's PREMISE INVERSION, recorded in
   * the tree rather than only in a report.
   *
   * objectui#4553 states that all three numeric formatters reach
   * `formatDisplayNumber` with `locale: undefined`. `formatPercent` does not:
   * it is `${percentDisplayValue(value).toFixed(precision)}%`, so it touches no
   * `Intl` at all and takes no locale parameter to thread. Its output is
   * therefore not the machine's locale but NO locale — ASCII, ungrouped,
   * identical on every machine. German would want `1.235 %`; every session
   * gets `1235%`.
   *
   * Fixing it means adding a parameter to a `@object-ui/fields` export, which
   * is outside this card's ruled surface — so it is pinned as-is here and
   * escalated. This assertion is a change-detector for a known-wrong output,
   * NOT a statement that the output is right; it is expected to fail on the
   * day `formatPercent` grows a locale, and that failure is the signal to
   * update it.
   */
  it('de percent stays ASCII and ungrouped — formatPercent takes no locale (objectui#4553 inverted premise)', async () => {
    renderSession('de');
    await waitFor(() => expect(screen.getByTestId('gv-fields-1')).toBeDefined());

    expect(screen.getByTestId(RATIO).textContent).toBe('Ratio=1235%');
    // The German rendering this row cannot currently produce, spelled out so
    // the gap is legible without re-deriving it from the formatter.
    expect(screen.getByTestId(RATIO).textContent).not.toBe(`Ratio=1.235${NBSP}%`);
  });
});
