// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#7178 — a dataset measure over a date field renders as a date.
 *
 * `formatMeasure` opened with `if (typeof v !== 'number') return String(v)`,
 * placed BEFORE `format` was read. So a `min` / `max` over a date or datetime
 * field printed its stored value verbatim — a 24-character ISO string in the
 * KPI tile's `text-2xl font-semibold`, wrapped over two lines — and the
 * `format` that `DatasetMeasureSchema` accepts was unreachable for it.
 *
 * ── What these cases pin, and what they deliberately do NOT ─────────────────
 * The fix is a ROUTE, not a formatter: every byte of date rendering comes from
 * `../date-display.ts`, which is where `@object-ui/fields`' `formatDate` /
 * `formatDateTime` now live and what the `date` cell renderer, `ObjectGrid`'s
 * date cells and `ObjectGantt`'s tooltips call. So the cases below assert
 * AGREEMENT WITH THAT PATH rather than literal strings wherever the path's own
 * output is the contract — a literal would pin this file's opinion of a date,
 * which is exactly the second convention objectui#4576 says not to create.
 * (`DatasetWidget.dateMeasure.test.tsx` closes the loop on the rendered
 * surfaces, and `@object-ui/fields`' `date-display.reexport-identity.test.ts`
 * pins that the cell's `formatDate` and this one are the same function.)
 *
 * ── Directions, predicted in writing BEFORE the run ─────────────────────────
 *   the two date cases            RED pre-fix — they render the raw ISO string
 *   the `format`-as-style cases   RED pre-fix — `format` was never read here
 *   ⭐ every must-not-move case    GREEN on both sides. These are the guard,
 *                                 not the fix: the new branch runs ahead of
 *                                 the `String(v)` short-circuit, so it has to
 *                                 be shown NOT to capture numbers, numeric
 *                                 strings, the nullish em dash, or prose.
 *
 * The full before/after sweep is recorded in the PR: 33,696 argument forms
 * (value x format x currency x percentScale x locale) compared against a
 * verbatim copy of the pre-fix function, 4 distinct values moved — every one
 * of them ISO-shaped and parseable — and 0 expected movers missed.
 */

import { describe, it, expect } from 'vitest';

import { formatMeasure } from '../dataset-format.js';
import { formatDate, formatDateTime } from '../date-display.js';

/** A NON-current year, so `formatDate`'s "drop the year" branch is not in play. */
const ISO_DATE = '2024-07-04';
const ISO_DATETIME = '2024-07-04T07:00:00.000Z';
const EN = 'en-US';

describe('formatMeasure routes a date-shaped measure through the shared date path (objectui#7178)', () => {
  it('renders a datetime measure as a datetime, not as its raw ISO string', () => {
    const out = formatMeasure(ISO_DATETIME, undefined, undefined, undefined, EN);
    expect(out).not.toBe(ISO_DATETIME);
    expect(out).toBe(formatDateTime(ISO_DATETIME, undefined, { locale: EN }));
  });

  it('renders a date-only measure as a date, not as its raw ISO string', () => {
    const out = formatMeasure(ISO_DATE, undefined, undefined, undefined, EN);
    expect(out).not.toBe(ISO_DATE);
    expect(out).toBe(formatDate(ISO_DATE, undefined, { locale: EN }));
  });

  it('accepts the space-separated ISO spelling a backend may send', () => {
    const spaced = '2024-07-04 07:00:00';
    expect(formatMeasure(spaced, undefined, undefined, undefined, EN)).toBe(
      formatDateTime(spaced, undefined, { locale: EN }),
    );
  });

  it('follows the display locale, like every other measure', () => {
    const de = formatMeasure(ISO_DATETIME, undefined, undefined, undefined, 'de-DE');
    const en = formatMeasure(ISO_DATETIME, undefined, undefined, undefined, EN);
    expect(de).not.toBe(en);
    expect(de).toBe(formatDateTime(ISO_DATETIME, undefined, { locale: 'de-DE' }));
  });
});

/**
 * The finding's reusable half: `DatasetMeasureSchema.format` is an open string
 * that parses and, on this path, could never be read. It is read now — as the
 * shared path's STYLE vocabulary, which is what that path actually accepts.
 * A date PATTERN is not part of that vocabulary, and these cases say so out
 * loud rather than leaving it silent, because "silent" is the whole card.
 */
describe('what `format` can and cannot say for a date measure (objectui#7178)', () => {
  it('honours `short` — the same word `DateCellRenderer` honours from `field.format`', () => {
    expect(formatMeasure(ISO_DATE, 'short', undefined, undefined, EN)).toBe(
      formatDate(ISO_DATE, 'short', { locale: EN }),
    );
    expect(formatMeasure(ISO_DATE, 'short', undefined, undefined, EN)).not.toBe(
      formatMeasure(ISO_DATE, undefined, undefined, undefined, EN),
    );
  });

  it('honours `relative`', () => {
    expect(formatMeasure(ISO_DATE, 'relative', undefined, undefined, EN)).toBe(
      formatDate(ISO_DATE, 'relative', { locale: EN }),
    );
  });

  it('⚠️ does NOT interpret a date PATTERN — `YYYY-MM-DD` renders the locale default', () => {
    // Measured, not assumed, and stated in the PR body: the shared date path
    // takes a named style, not a pattern. This case exists so the limit is
    // pinned rather than rediscovered — and so that teaching the shared path a
    // pattern grammar later has a test that must be updated deliberately.
    const patterned = formatMeasure(ISO_DATE, 'YYYY-MM-DD', undefined, undefined, EN);
    expect(patterned).not.toBe('2024-07-04');
    expect(patterned).toBe(formatMeasure(ISO_DATE, undefined, undefined, undefined, EN));
  });
});

/**
 * ⭐ The regression guard. The date branch runs ahead of the `String(v)`
 * short-circuit, so every one of these has to be shown NOT to reach it.
 */
describe('formatMeasure leaves every non-date value exactly where it was (objectui#7178)', () => {
  it('formats numbers through the numeral path, untouched', () => {
    expect(formatMeasure(1234.5, '0.0', undefined, undefined, EN)).toBe('1,234.5');
    expect(formatMeasure(1234.5, '0.00', 'EUR', undefined, EN)).toBe('€1,234.50');
    expect(formatMeasure(0.75, '0.0%', undefined, 'fraction', EN)).toBe('75.0%');
    expect(formatMeasure(42, undefined, undefined, undefined, EN)).toBe('42');
    expect(formatMeasure(2026, undefined, undefined, undefined, EN)).toBe('2026');
  });

  it('⭐ never reads a NUMERIC STRING as a date', () => {
    // `1751612400000` is epoch milliseconds for a real instant, and `2026` is a
    // year. Both are what a count or an id looks like coming back from a
    // measure, and `Date.parse` would take either if it were asked.
    for (const v of ['0', '42', '1234.5', '-1234.5', '1751612400000', '2026', '1e21']) {
      expect(formatMeasure(v, undefined, undefined, undefined, EN)).toBe(v);
      expect(formatMeasure(v, 'YYYY-MM-DD', undefined, undefined, EN)).toBe(v);
    }
  });

  it('keeps the nullish em dash', () => {
    expect(formatMeasure(null)).toBe('—');
    expect(formatMeasure(undefined)).toBe('—');
    expect(formatMeasure(null, 'YYYY-MM-DD', undefined, undefined, EN)).toBe('—');
  });

  it('falls through to `String(v)` for an arbitrary non-numeric, non-date value', () => {
    for (const v of ['Acme Corp', 'N/A', '', 'March 5, 2026', '2026-07', '2026/07/04', '04-07-2026']) {
      expect(formatMeasure(v, undefined, undefined, undefined, EN)).toBe(String(v));
    }
    expect(formatMeasure(true, undefined, undefined, undefined, EN)).toBe('true');
  });

  it('leaves an ISO-SHAPED but unparseable value alone rather than showing an em dash', () => {
    // `formatDate` answers `—` for an unparseable value. Routing one there
    // would REPLACE a raw string the author can still debug with a dash that
    // says nothing, so the parse guard keeps these on the old path.
    for (const v of ['2026-13-45', '2024-07-04T99:99']) {
      expect(formatMeasure(v, undefined, undefined, undefined, EN)).toBe(v);
    }
  });

  it('agrees with the list cell on a rolled-over date instead of second-guessing it', () => {
    // `Date.parse('2024-02-30')` is NOT NaN — V8 rolls it to March 1/2. Every
    // date surface in the repo builds its `Date` the same way, so this renders
    // as the same day a list cell shows for the same stored string. Pinned
    // because it is the one place agreement looks like a bug.
    const rolled = '2024-02-30';
    expect(Number.isNaN(Date.parse(rolled))).toBe(false);
    expect(formatMeasure(rolled, undefined, undefined, undefined, EN)).toBe(
      formatDate(rolled, undefined, { locale: EN }),
    );
  });
});
