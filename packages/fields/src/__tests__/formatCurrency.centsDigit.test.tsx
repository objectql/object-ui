/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4332 — `formatCurrency` dropped a real cents digit.
 *
 * The symbol branch passed `minimumFractionDigits: 0` against a
 * wholeness-switched `maximumFractionDigits`, handing Intl the RANGE `[0, 2]`.
 * Intl then emits the shortest representation in range, so a genuine cents
 * value of `.50` printed as `.5`: `$1,234.5`, `$19.9`, `$0.5` — money on a
 * record page reading as a data error rather than a formatting one.
 *
 * The fix is one width for both bounds (`isWhole ? 0 : 2`), which also makes
 * the function's three branches agree: the no-currency branch already routed
 * through `formatNumber` (both bounds = the width), and the bad-currency
 * fallback already used `toFixed`. Only the symbol branch disagreed.
 *
 * What is pinned here, and why each half matters:
 *
 *  1. **Fractional amounts keep both cents digits** — the defect.
 *  2. **Whole amounts still drop `.00`** — the OTHER half of the wholeness
 *     switch, which the doc comment promises just as explicitly ("Salesforce
 *     convention: `$1,234.50` keeps cents; `$1,234` does not") and which
 *     objectui#4033 independently pinned through the renderer. Widening the
 *     minimum to a constant 2 would have "fixed" this card by breaking that
 *     one, so it is a control, not a decoration.
 *  3. **The branches that were already correct are unchanged** — no-currency,
 *     bad-currency fallback, and `formatCompactCurrency` (a different function
 *     with its own `maximumFractionDigits: 1` compact policy).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LocalizationProvider } from '@object-ui/i18n';
import {
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  CurrencyCellRenderer,
} from '../index';

describe('formatCurrency — a fractional amount keeps both cents digits (objectui#4332)', () => {
  it("renders the card's fixture as the doc comment promises", () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });

  it.each([
    [19.9, '$19.90'],
    [0.5, '$0.50'],
    [1234.5, '$1,234.50'],
  ])('an amount ending in a zero cent digit keeps it: %s', (value, expected) => {
    // The issue's impact list — every price whose cents end in 0 was truncated
    // by one digit (`$19.9`, `$0.5`).
    expect(formatCurrency(value as number, 'USD', 'en-US')).toBe(expected as string);
  });

  it('keeps the sign in front of a truncated-then-restored amount', () => {
    expect(formatCurrency(-1234.5, 'USD', 'en-US')).toBe('-$1,234.50');
  });

  it('a fractional amount that ROUNDS to zero cents still shows them', () => {
    // Sub-cent precision: `1234.001` is not whole, so it keeps cents and
    // rounds into them. Before the fix the `[0, 2]` range rounded to `.00` and
    // then trimmed it away, printing a bare `$1,234` for a value that is NOT
    // the whole number that spelling claims. Deliberate: wholeness — not the
    // rounded output — decides whether cents are shown.
    expect(formatCurrency(1234.001, 'USD', 'en-US')).toBe('$1,234.00');
  });

  it('still caps at two digits (the maximum is unchanged)', () => {
    expect(formatCurrency(1234.567, 'USD', 'en-US')).toBe('$1,234.57');
    expect(formatCurrency(1234.56, 'USD', 'en-US')).toBe('$1,234.56');
  });

  it('follows the active locale while doing it (objectui#4033 is not disturbed)', () => {
    // de-DE: dot grouping, comma decimal mark, TRAILING symbol separated by
    // U+00A0. Matched loosely on the separator (written as an escape, never a
    // raw byte) so an ICU spacing change cannot fail the digits this pins.
    expect(formatCurrency(1234.5, 'EUR', 'de-DE')).toMatch(/^1\.234,50\s*€$/);
  });
});

describe('formatCurrency — CONTROL: the whole-number half of the switch is untouched', () => {
  it.each([
    [1234, '$1,234'],
    [5000000, '$5,000,000'],
    [0, '$0'],
  ])('a whole amount still drops `.00`: %s', (value, expected) => {
    // The doc comment promises this as explicitly as it promises the cents,
    // and objectui#4033 pinned it through `CurrencyCellRenderer`. A constant
    // `minimumFractionDigits: 2` would turn all three of these into `.00`.
    expect(formatCurrency(value as number, 'USD', 'en-US')).toBe(expected as string);
  });

  it('a non-finite amount is unaffected (it is not "whole")', () => {
    expect(formatCurrency(Number.NaN, 'USD', 'en-US')).toBe('$NaN');
  });
});

describe('formatCurrency — CONTROL: the branches that were already correct', () => {
  it('the no-currency branch is unchanged — it never had the defect', () => {
    // It routes through `formatNumber`, which sets BOTH bounds to the width it
    // is given, so it already rendered `1,234.50` while the symbol branch
    // rendered `$1,234.5`. That disagreement is what the fix removes.
    expect(formatCurrency(1234.5, undefined, 'en-US')).toBe('1,234.50');
    expect(formatCurrency(1234.5, undefined, 'en-US')).toBe(formatNumber(1234.5, 2, 'en-US'));
    // A whole amount with no currency is still money and keeps its separators
    // (objectui#4033: `formatNumber` passes no `scale`, so the ordinal
    // no-grouping policy cannot fire here).
    expect(formatCurrency(5000000, undefined, 'en-US')).toBe('5,000,000');
  });

  it('the bad-currency fallback is unchanged — it always used toFixed', () => {
    // `Intl` throws `RangeError: Invalid currency code` for a non-ISO-4217
    // code, and `formatDisplayNumber`'s locale retry re-throws it rather than
    // swallowing it, so this lands in `formatCurrency`'s own catch.
    expect(formatCurrency(1234.5, 'NOT_A_CODE', 'en-US')).toBe('NOT_A_CODE 1234.50');
  });

  it('formatCompactCurrency is a different function and keeps its own policy', () => {
    // Compact notation caps at ONE fraction digit and strips a trailing `.0`;
    // it never had the `[0, max]` range, and this card does not touch it.
    expect(formatCompactCurrency(1234.5, 'USD', 'en-US')).toBe('$1.2K');
    expect(formatCompactCurrency(150000, 'USD', 'en-US')).toBe('$150K');
  });
});

describe('CurrencyCellRenderer — the user-visible surface (objectui#4332)', () => {
  const renderCurrency = (value: unknown, field: Record<string, unknown>, locale?: string) =>
    render(
      <LocalizationProvider value={{ locale }}>
        <CurrencyCellRenderer value={value as any} field={{ type: 'currency', ...field } as any} />
      </LocalizationProvider>,
    );

  it('a grid cell shows the cents digit the amount actually has', () => {
    renderCurrency(1234.5, { currency: 'USD' }, 'en-US');
    expect(screen.getByText('$1,234.50')).toBeInTheDocument();
  });

  it('CONTROL: a declared `scale` is inert on the currency cell path', () => {
    // Measured, not assumed: `CurrencyCellRenderer` reads `currency` and never
    // `scale`, and `formatCurrency` takes no scale argument — on this path
    // `scale` is neither a display width nor (money always groups) a grouping
    // input. So a currency field declaring `scale: 0` renders exactly like one
    // declaring nothing, before and after this card. Pinned so that a future
    // change making `scale` load-bearing here has to say so out loud.
    renderCurrency(1234.5, { currency: 'USD', scale: 0 }, 'en-US');
    expect(screen.getByText('$1,234.50')).toBeInTheDocument();
  });
});
