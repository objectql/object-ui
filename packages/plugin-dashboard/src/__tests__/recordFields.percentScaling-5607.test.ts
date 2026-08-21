/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5607 — the record-field percent branch stops re-deciding what
 * `@object-ui/core` owns.
 *
 * `renderFieldValue`'s `%`-format branch used to normalise the value itself
 * before calling `formatPercent`:
 *
 *   const normalized = value > 1 ? value / 100 : value;
 *   return formatPercent(normalized * 100, decimals, displayLocale);
 *
 * `formatPercent` already applies `percentDisplayValue`, which its own doc
 * comment names as the SINGLE source of truth for percent display scaling. So
 * this was a second, drifted copy of one decision, and it is now deleted: the
 * raw stored value goes to `formatPercent` — the identical call the list-view
 * percent cell already makes for an ordinary percent column
 * (`PercentCellRenderer`, `@object-ui/fields`).
 *
 * ── Measured on the current tip BEFORE the repair ────────────────────────
 * Core already handles BOTH arms, which is why the local branch goes rather
 * than gets patched: `percentDisplayValue(0.75) === 75` (fraction) and
 * `percentDisplayValue(1.605) === 1.605` (already points, passed through), so
 * `formatPercent(1.605, 2, 'en-US')` is `1.61%` with no help from the caller.
 *
 * ── Directions, predicted in writing BEFORE the run ──────────────────────
 * Runner machine locale is irrelevant: every case threads an explicit
 * `'en-US'`, so these are locale-pinned, not locale-dependent.
 *   the five movers          RED on the round-trip form, green repaired
 *   double-scaled fraction   RED on the round-trip form (`50.00%` for 0.005)
 *   negative already-points  RED on the round-trip form (`-500.00%` for -5)
 *   the exactly-1 boundary   RED on the round-trip form (`100.00%` for 1)
 *   CONTROL                  GREEN on BOTH forms — see its own note
 */

import { describe, it, expect } from 'vitest';
import { renderFieldValue, type FieldMeta } from '../recordFields';

/**
 * One percent-formatted record field, rendered exactly as the dashboard table
 * and the record-detail drawer render it. `'0.00%'` is what drives the branch's
 * own `decimals` extraction to 2 — the precision every value below is quoted at.
 */
const pct = (value: number, format = '0.00%'): string =>
  renderFieldValue(
    value,
    { name: 'rate', label: 'Rate', type: 'number', format } satisfies FieldMeta,
    undefined,
    'en-US',
  ) as string;

describe('renderFieldValue percent branch — core owns the scaling (objectui#5607)', () => {
  /**
   * The five movers named in the card, each a last-digit off-by-one that the
   * `(value / 100) * 100` round trip produced. These are the falsification
   * criterion: on the unrepaired branch every one of them renders the value in
   * the second column and this case is RED.
   *
   *   1.605 -> repaired 1.61%   round trip 1.60%
   *   1.655 -> repaired 1.66%   round trip 1.65%
   *   1.705 -> repaired 1.71%   round trip 1.70%
   *   1.785 -> repaired 1.79%   round trip 1.78%
   *   1.835 -> repaired 1.84%   round trip 1.83%
   */
  it.each([
    [1.605, '1.61%'],
    [1.655, '1.66%'],
    [1.705, '1.71%'],
    [1.785, '1.79%'],
    [1.835, '1.84%'],
  ])('renders %p half-up at 2 decimals as %p, not the round trip\'s last-digit-down', (value, expected) => {
    expect(pct(value as number)).toBe(expected);
  });

  /**
   * CONTROL — same function, same format, same locale, same precision as the
   * cases above; only the VALUES differ, chosen because the round trip and the
   * repair were measured to agree on them.
   *
   * It is green on the unrepaired code as well as the repaired code, and that
   * is its whole job: it shows the movers above are a targeted red and not a
   * branch that stopped rendering percents at all. It can still fail — a wrong
   * precision, a dropped locale, a lost `%` affix or a broken branch takes it
   * down with everything else, which is what makes it a control rather than a
   * tautology.
   */
  it.each([
    [0.75, '75.00%'],
    [2.5, '2.50%'],
    [12.25, '12.25%'],
    [57, '57.00%'],
  ])('CONTROL: %p renders %p under both the round trip and the repair', (value, expected) => {
    expect(pct(value as number)).toBe(expected);
  });

  /**
   * The same defect's other two faces, both fixed by the same deletion.
   *
   * A stored fraction below 0.01 was scaled TWICE — the local `* 100` put it
   * back under 1, so `percentDisplayValue`'s fraction arm scaled it again. That
   * is a factor of 100, not a last digit.
   */
  it('does not double-scale a stored fraction below 0.01', () => {
    expect(pct(0.005)).toBe('0.50%');
    expect(pct(0.0075)).toBe('0.75%');
  });

  /**
   * The local test was `value > 1`; core's is the symmetric `|value| < 1`. A
   * negative already in percentage points therefore took the fraction arm.
   */
  it('treats a negative already in percentage points as points, like core does', () => {
    expect(pct(-5)).toBe('-5.00%');
    expect(pct(-0.5)).toBe('-50.00%');
  });

  /**
   * The boundary itself. `percentDisplayValue` is `value > -1 && value < 1`, so
   * exactly 1 is percentage points and renders `1%` — the convention
   * `PercentScale` states in those words (`whole` is `1 => "1%"`). The local
   * branch's `value > 1` put exactly 1 on the fraction side and rendered
   * `100.00%`, which is the drift this card removes.
   */
  it('puts exactly 1 on core\'s side of the boundary', () => {
    expect(pct(1)).toBe('1.00%');
    expect(pct(0.999)).toBe('99.90%');
  });

  /**
   * The branch's own `decimals` extraction is untouched by the repair, and this
   * pins that: `'0.0%'` is 1 decimal, a bare `'%'` matches no `0.(0+)%` group
   * and is 0.
   */
  it('still reads the precision out of the format string', () => {
    expect(pct(1.605, '0.0%')).toBe('1.6%');
    expect(pct(1.605, '%')).toBe('2%');
  });
});
