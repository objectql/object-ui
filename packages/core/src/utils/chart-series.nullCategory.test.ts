/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4466 — a NULL-keyed group must render as an explicit bucket, never
 * vanish.
 *
 * The single-dimension branch of `buildChartSeries` passed rows through
 * verbatim, so a row whose category VALUE is `null` reached recharts with a
 * null category and drew no mark. The sharpest measured case is the partial
 * one: `[{user_id: null, event_count: 51}, {user_id: 'Dev Admin',
 * event_count: 2}]` drew exactly ONE bar — the DOMINANT group (51 of 53
 * events) silently dropped, while the y-axis scale still accommodated it. The
 * chart was not merely empty, it understated its own data without saying so.
 *
 * This is the shipped first-boot state of the built-in System Overview board:
 * every seeded `sys_audit_log` row is written with `user_id = NULL`, so "Events
 * by User" groups to exactly one row and drew nothing at all.
 *
 * The division of labour with the framework#4033 guard is pinned here too,
 * because the fix could easily erase it: a row that does not carry the category
 * key AT ALL is NOT bucketed — that shape belongs to `hasNoCategoryKey`
 * (plugin-charts' `AdvancedChartImpl`), which explains itself instead of
 * drawing an empty axis. Key absent → that path; key present, value null →
 * this bucket.
 */
import { describe, it, expect } from 'vitest';
import { buildChartSeries, findChartSeriesRow, NULL_CATEGORY_LABEL } from './chart-series';

/** The card's case 3, verbatim — the dominant group is the null-keyed one. */
const PARTIAL = [
  { user_id: null, event_count: 51 },
  { user_id: 'Dev Admin', event_count: 2 },
];

/** The card's case 1/2 — the organic first-boot seed state. */
const ALL_NULL = [{ user_id: null, event_count: 50 }];

describe('buildChartSeries — null-keyed category bucket (objectui#4466)', () => {
  it('labels the null group instead of dropping it (the partial case)', () => {
    const r = buildChartSeries(PARTIAL, ['user_id'], ['event_count']);

    expect(r.xAxisKey).toBe('user_id');
    // BOTH groups survive, and the null one keeps its 51 events.
    expect(r.data).toEqual([
      { user_id: NULL_CATEGORY_LABEL, event_count: 51 },
      { user_id: 'Dev Admin', event_count: 2 },
    ]);
  });

  it('labels the all-null result rather than drawing an axis with no marks', () => {
    const r = buildChartSeries(ALL_NULL, ['user_id'], ['event_count']);
    expect(r.data).toEqual([{ user_id: NULL_CATEGORY_LABEL, event_count: 50 }]);
  });

  it('buckets an undefined category value the same way', () => {
    const r = buildChartSeries([{ user_id: undefined, event_count: 7 }], ['user_id'], ['event_count']);
    expect(r.data).toEqual([{ user_id: NULL_CATEGORY_LABEL, event_count: 7 }]);
  });

  it('uses the caller-supplied (localized) label when one is given', () => {
    const r = buildChartSeries(ALL_NULL, ['user_id'], ['event_count'], null, {
      nullCategoryLabel: '(未指定)',
    });
    expect(r.data).toEqual([{ user_id: '(未指定)', event_count: 50 }]);
  });

  it('never mutates the caller rows — drill-through reads the raw null', () => {
    const rows = [{ user_id: null, event_count: 50 }];
    buildChartSeries(rows, ['user_id'], ['event_count']);
    expect(rows[0].user_id).toBeNull();
  });

  it('leaves a row that lacks the category key ENTIRELY to the #4033 guard', () => {
    // Adding the key here would erase `hasNoCategoryKey`'s whole signal: the
    // renderer would draw an "(None)" axis instead of naming the unprojected
    // dimension. Key absent is a different defect with a different answer.
    const unreadable = [{ count: 2 }, { count: 8 }];
    const r = buildChartSeries(unreadable, ['issued'], ['count']);
    expect(r.data).toBe(unreadable);
    expect(r.data.every((row) => !('issued' in row))).toBe(true);
  });
});

describe('buildChartSeries — must-not-change (objectui#4466)', () => {
  it('returns non-null rows BY IDENTITY, unchanged', () => {
    const rows = [
      { status: 'Backlog', est_hours: 5 },
      { status: 'Done', est_hours: 24 },
    ];
    const r = buildChartSeries(rows, ['status'], ['est_hours']);
    expect(r.data).toBe(rows);
    expect(r.data).toEqual(rows);
  });

  it('keeps an empty result set empty — the designed empty state is untouched', () => {
    const r = buildChartSeries([], ['user_id'], ['event_count']);
    expect(r.data).toEqual([]);
  });

  it('leaves the multi-dimension pivot branch exactly as it was', () => {
    const rows = [
      { status: 'Backlog', priority: 'High', est_hours: 5 },
      { status: null, priority: 'Low', est_hours: 3 },
    ];
    const r = buildChartSeries(rows, ['status', 'priority'], ['est_hours']);
    // Pre-existing pivot behaviour: a null x collapses to the '' bucket and the
    // row keeps its raw null. Pinned as-is — this branch is out of #4466's
    // ruled scope, and the pin makes any future change to it deliberate.
    expect(r.data).toEqual([
      { status: 'Backlog', High: 5 },
      { status: null, Low: 3 },
    ]);
  });
});

describe('findChartSeriesRow — the bucket label maps back to its null row (objectui#4466)', () => {
  it('matches the bucket label against the raw null category', () => {
    // Symmetry with buildChartSeries: without it, clicking the rendered
    // "(None)" bar resolves to index -1 and the drill silently no-ops.
    expect(findChartSeriesRow(PARTIAL, ['user_id'], ['event_count'], NULL_CATEGORY_LABEL)).toBe(0);
    expect(findChartSeriesRow(PARTIAL, ['user_id'], ['event_count'], 'Dev Admin')).toBe(1);
  });

  it('matches a caller-supplied bucket label the same way', () => {
    expect(
      findChartSeriesRow(ALL_NULL, ['user_id'], ['event_count'], '(未指定)', undefined, {
        nullCategoryLabel: '(未指定)',
      }),
    ).toBe(0);
  });

  it('still resolves the empty-string category to a null row (unchanged)', () => {
    // The pre-existing `String(r[xDim] ?? '')` behaviour, kept: the pivot/drill
    // layer already spells "no group value" as '' (see computeDrillFilter).
    expect(findChartSeriesRow(ALL_NULL, ['user_id'], ['event_count'], '')).toBe(0);
  });
});
