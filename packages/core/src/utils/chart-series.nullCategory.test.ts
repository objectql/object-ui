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
 *
 * objectui#4497 extends the same doctrine to the MULTI-dimension pivot branch,
 * which #4466 deliberately left pinned as-is (that pin is updated below, in the
 * commit that changed it). The pivot's mechanism differs in exactly one way,
 * which is why it needed its own card: it buckets rows by a map KEY
 * (`String(xRaw ?? '')`) and writes a separate DISPLAY value into the emitted
 * row, so a null x was bucketed correctly and STILL reached recharts raw. The
 * key is untouched; only the display value is labelled. The drill half is
 * pinned at the bottom of this file, with the measurement behind it.
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

  /**
   * THE DELIBERATE-PIN UPDATE (objectui#4497).
   *
   * This case used to read "leaves the multi-dimension pivot branch exactly as
   * it was" and asserted `{status: null, Low: 3}` — #4466's pivot behaviour
   * pinned AS-IS, not as correct, precisely so that changing it would have to
   * be a deliberate act with a card behind it. #4497 is that card: it ruled the
   * pivot inherits this branch's answer, so the pin moves here, in the same
   * commit as the fix.
   */
  it('buckets the pivot branch the SAME way, as of objectui#4497', () => {
    const rows = [
      { status: 'Backlog', priority: 'High', est_hours: 5 },
      { status: null, priority: 'Low', est_hours: 3 },
    ];
    const r = buildChartSeries(rows, ['status', 'priority'], ['est_hours']);
    expect(r.data).toEqual([
      { status: 'Backlog', High: 5 },
      { status: NULL_CATEGORY_LABEL, Low: 3 },
    ]);
  });
});

/**
 * objectui#4497 — the pivot branch, whose mechanism differs from the branch
 * above in one way that had to be measured before it could be changed: it
 * buckets by a map KEY (`String(xRaw ?? '')`) and writes a separate DISPLAY
 * value into the emitted row. The fix moves the display value only; the key is
 * untouched, so WHICH rows share a bar is byte-identical to before.
 */
describe('buildChartSeries — the pivot branch buckets null too (objectui#4497)', () => {
  it('labels the null first-dimension bucket instead of emitting a raw null', () => {
    const r = buildChartSeries(
      [
        { status: 'Backlog', priority: 'High', est_hours: 5 },
        { status: null, priority: 'Low', est_hours: 3 },
      ],
      ['status', 'priority'],
      ['est_hours'],
    );
    expect(r.xAxisKey).toBe('status');
    expect(r.series).toEqual([
      { dataKey: 'High', label: 'High' },
      { dataKey: 'Low', label: 'Low' },
    ]);
    // Pre-fix: `{status: null, Low: 3}` — a null category reaching recharts,
    // which draws no mark (the #4466 mechanism, one branch over).
    expect(r.data).toEqual([
      { status: 'Backlog', High: 5 },
      { status: NULL_CATEGORY_LABEL, Low: 3 },
    ]);
  });

  it('buckets an undefined first-dimension value the same way', () => {
    const r = buildChartSeries(
      [{ status: undefined, priority: 'Low', est_hours: 3 }],
      ['status', 'priority'],
      ['est_hours'],
    );
    expect(r.data).toEqual([{ status: NULL_CATEGORY_LABEL, Low: 3 }]);
  });

  it('uses the caller-supplied (localized) label, from the same option', () => {
    const r = buildChartSeries(
      [{ status: null, priority: 'Low', est_hours: 3 }],
      ['status', 'priority'],
      ['est_hours'],
      null,
      { nullCategoryLabel: '(未指定)' },
    );
    expect(r.data).toEqual([{ status: '(未指定)', Low: 3 }]);
  });

  it('keeps the null bucket MERGED with every other null row, as before', () => {
    // The bucket key is unchanged, so two null-x rows still share one bar and
    // contribute a column each — the label lands on the bucket, not per row.
    const r = buildChartSeries(
      [
        { status: null, priority: 'Low', est_hours: 3 },
        { status: null, priority: 'High', est_hours: 8 },
      ],
      ['status', 'priority'],
      ['est_hours'],
    );
    expect(r.data).toEqual([{ status: NULL_CATEGORY_LABEL, Low: 3, High: 8 }]);
  });

  it('never mutates the caller rows — drill-through reads the raw null', () => {
    const rows = [{ status: null, priority: 'Low', est_hours: 3 }];
    buildChartSeries(rows, ['status', 'priority'], ['est_hours']);
    expect(rows[0].status).toBeNull();
  });
});

describe('buildChartSeries — pivot must-not-change (objectui#4497)', () => {
  it('leaves non-null pivot groups byte-identical', () => {
    const rows = [
      { status: 'Backlog', priority: 'High', est_hours: 5 },
      { status: 'Backlog', priority: 'Low', est_hours: 3 },
      { status: 'Done', priority: 'High', est_hours: 24 },
    ];
    const r = buildChartSeries(rows, ['status', 'priority'], ['est_hours']);
    expect(r.data).toEqual([
      { status: 'Backlog', High: 5, Low: 3 },
      { status: 'Done', High: 24 },
    ]);
    expect(r.data.some((row) => row.status === NULL_CATEGORY_LABEL)).toBe(false);
  });

  it('does NOT relabel a genuine empty-string group — it is a value, not a null', () => {
    // `''` and null share the bucket KEY (pre-existing), but only null is
    // absent data. A stored empty string keeps its own (empty) display value.
    const r = buildChartSeries(
      [{ status: '', priority: 'High', est_hours: 5 }],
      ['status', 'priority'],
      ['est_hours'],
    );
    expect(r.data).toEqual([{ status: '', High: 5 }]);
  });

  it('keeps an empty pivot result empty — no phantom bucket row', () => {
    const r = buildChartSeries([], ['status', 'priority'], ['est_hours']);
    expect(r.data).toEqual([]);
    expect(r.series).toEqual([]);
  });

  it('does NOT bucket a row that lacks the category key ENTIRELY', () => {
    // Same division as the single-dimension branch: key absent is a different
    // defect (a dimension grouped by but never projected) and must not be
    // relabelled "(None)", which would say the records have no value.
    //
    // MEASURED LIMIT, deliberately pinned: the pivot writes `[xKey]` onto every
    // bucket it creates, so this shape reaches the renderer WITH the key and
    // `hasNoCategoryKey` (framework#4033) cannot see it — that was already true
    // before #4497 and is unchanged by it. Filed separately rather than widened
    // into this card.
    const r = buildChartSeries(
      [{ priority: 'Low', est_hours: 3 }],
      ['status', 'priority'],
      ['est_hours'],
    );
    expect(r.data).toEqual([{ status: undefined, Low: 3 }]);
    expect(r.data[0].status).not.toBe(NULL_CATEGORY_LABEL);
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

/**
 * objectui#4497's DRILL half — the newly-visible pivot bar keeps its click.
 *
 * The measurement the card asked for, pinned rather than described. The pivot's
 * emitted rows are AGGREGATED (`byX` collapses N raw rows into one bucket per
 * first-dimension value), so — unlike every table/pivot surface — they are NOT
 * index-aligned with `drillRawRows` and a caller cannot drill by the emitted
 * row's position. `DatasetWidget.handleChartDrill`, the one production caller,
 * therefore SEARCHES the raw rows through `findChartSeriesRow` and indexes
 * `drillRawRows` with what it returns.
 *
 * That is why the pivot's split between map key and emitted display value never
 * reached the drill, and why #4497 changed `buildChartSeries` alone: the raw
 * rows searched here still carry their null, and `xOf` (objectui#4466) already
 * reads a bucket label back to them in the MULTI-dimension arm as well as the
 * single-dimension one. These cases pin that the two halves agree — a
 * regression in either would be a dead click, which is what #4466 named.
 */
describe('findChartSeriesRow — the pivot bucket bar keeps its drill (objectui#4497)', () => {
  /** Raw dataset rows, the shape `drillRawRows` is index-aligned with. */
  const PIVOT_RAW = [
    { status: 'Backlog', priority: 'High', est_hours: 5 },
    { status: null, priority: 'Low', est_hours: 3 },
    { status: null, priority: 'High', est_hours: 8 },
  ];

  it('resolves the rendered bucket label to the RAW row, per series', () => {
    const idxLow = findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], NULL_CATEGORY_LABEL, 'Low');
    const idxHigh = findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], NULL_CATEGORY_LABEL, 'High');
    expect(idxLow).toBe(1);
    expect(idxHigh).toBe(2);
    // The index is into the RAW rows — the drill filter is built from
    // `drillRawRows[idx]`, which still carries the null the bar was drawn for.
    expect(PIVOT_RAW[idxLow]).toEqual({ status: null, priority: 'Low', est_hours: 3 });
    expect(PIVOT_RAW[idxHigh]).toEqual({ status: null, priority: 'High', est_hours: 8 });
  });

  it('is NOT the emitted row index — the pivot aggregates, so alignment cannot exist', () => {
    const emitted = buildChartSeries(PIVOT_RAW, ['status', 'priority'], ['est_hours']).data;
    // 3 raw rows → 2 bars. Any caller drilling by emitted position would read
    // the wrong record; this helper is what makes the click correct instead.
    expect(emitted).toHaveLength(2);
    expect(PIVOT_RAW).toHaveLength(3);
    expect(emitted[1]).toEqual({ status: NULL_CATEGORY_LABEL, Low: 3, High: 8 });
    expect(findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], NULL_CATEGORY_LABEL, 'High')).toBe(2);
  });

  it('matches a caller-supplied localized bucket label the same way', () => {
    expect(
      findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], '(未指定)', 'Low', {
        nullCategoryLabel: '(未指定)',
      }),
    ).toBe(1);
  });

  it('keeps the legacy empty-string category spelling working (unchanged)', () => {
    expect(findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], '', 'Low')).toBe(1);
  });

  it('leaves non-null pivot drills exactly as they were', () => {
    expect(findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], 'Backlog', 'High')).toBe(0);
    expect(findChartSeriesRow(PIVOT_RAW, ['status', 'priority'], ['est_hours'], 'Backlog', 'Low')).toBe(-1);
  });
});

/**
 * The two MEASURED AMBIGUITIES of the bucket label, pinned as the limits they
 * are (objectui#4497). Neither is created by that card and neither is fixed by
 * it — both are properties of the #4466 doctrine itself, filed rather than
 * widened into this surface. They are pinned so the next change to either
 * branch has to face them explicitly.
 */
describe('findChartSeriesRow — the measured limits of the bucket label (objectui#4497)', () => {
  it('DEAD, not wrong: an empty-string row sharing the null bucket has no drill of its own', () => {
    // The bucket KEY merges null and '' (`String(xRaw ?? '')`), so these two
    // raw rows draw ONE bar carrying both series. The bar is labelled from the
    // row that created the bucket, and the `''` row's segment then matches no
    // category: -1, which `handleChartDrill` returns on — a no-op click, never
    // a drill into the wrong records. Pre-#4497 the whole bar was invisible, so
    // this is strictly more affordance than before, not a regression.
    const merged = [
      { status: null, priority: 'Low', n: 3 },
      { status: '', priority: 'High', n: 5 },
    ];
    expect(buildChartSeries(merged, ['status', 'priority'], ['n']).data).toEqual([
      { status: NULL_CATEGORY_LABEL, Low: 3, High: 5 },
    ]);
    expect(findChartSeriesRow(merged, ['status', 'priority'], ['n'], NULL_CATEGORY_LABEL, 'Low')).toBe(0);
    expect(findChartSeriesRow(merged, ['status', 'priority'], ['n'], NULL_CATEGORY_LABEL, 'High')).toBe(-1);
  });

  it('and the SAME two groups keep both drills when the empty-string row comes first', () => {
    // The other row order of the case above, pinned because the two do NOT
    // behave alike and only one of them loses anything. The bucket takes its
    // label from whichever row CREATED it: with the `''` row first the label is
    // the raw empty string, `isNullCategory` never fires, and `xOf` reads a null
    // row back as `''` whenever the clicked category is not the bucket label —
    // so BOTH segments resolve, and neither resolves to the wrong record.
    //
    // This is the ruling's STOP condition measured to its end (objectui#4497):
    // "two raw groups mapping to one label" is real, but it costs a drill in
    // exactly one of the two orders. Widening `findChartSeriesRow` to close that
    // one would make a bar labelled `(None)` drill to a row whose stored value
    // is `''` — a wrong click traded for a dead one — so the limit is filed
    // (objectui#4508) rather than fixed here.
    const merged = [
      { status: '', priority: 'High', n: 5 },
      { status: null, priority: 'Low', n: 3 },
    ];
    expect(buildChartSeries(merged, ['status', 'priority'], ['n']).data).toEqual([
      { status: '', High: 5, Low: 3 },
    ]);
    expect(findChartSeriesRow(merged, ['status', 'priority'], ['n'], '', 'High')).toBe(0);
    expect(findChartSeriesRow(merged, ['status', 'priority'], ['n'], '', 'Low')).toBe(1);

    // MEASURED, and deliberately not what was predicted: the reader is looser
    // than the writer. `xOf` accepts BOTH spellings of "no value" (the bucket
    // label and the legacy `''`) unconditionally — #4466's stated design — so
    // it resolves the label even in this order, where NO bar was labelled with
    // it. Harmless in the real flow, because the only category a renderer ever
    // hands back is one recharts actually painted (here: `''`), and it is the
    // slack that makes the two callers' label agreement a non-issue. Pinned
    // because the asymmetry is invisible from `buildChartSeries` alone.
    expect(findChartSeriesRow(merged, ['status', 'priority'], ['n'], NULL_CATEGORY_LABEL, 'Low')).toBe(1);
  });

  it('first match wins when a STORED value spells the bucket label literally', () => {
    // A row whose stored category IS the label string keeps its own bucket (the
    // key is `'(None)'`, not `''`), so two bars carry the same axis text and the
    // click resolves to the first. Inherited from the single-dimension branch,
    // where #4466 shipped exactly this trade — the pivot does not add to it.
    const literal = [
      { status: NULL_CATEGORY_LABEL, priority: 'High', n: 1 },
      { status: null, priority: 'High', n: 2 },
    ];
    expect(buildChartSeries(literal, ['status', 'priority'], ['n']).data).toEqual([
      { status: NULL_CATEGORY_LABEL, High: 1 },
      { status: NULL_CATEGORY_LABEL, High: 2 },
    ]);
    expect(findChartSeriesRow(literal, ['status', 'priority'], ['n'], NULL_CATEGORY_LABEL, 'High')).toBe(0);
  });
});
