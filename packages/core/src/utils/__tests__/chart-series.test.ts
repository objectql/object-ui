/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  buildOptionColorMap,
  buildDimensionLabelMap,
  relabelDimensions,
  buildChartSeries,
} from '../chart-series';

describe('buildOptionColorMap', () => {
  const health = [
    { label: 'Green', value: 'green', color: '#10B981', default: true },
    { label: 'Yellow', value: 'yellow', color: '#F59E0B' },
    { label: 'Red', value: 'red', color: '#EF4444' },
  ];

  it('keys each option color by BOTH its value and its label', () => {
    // A dataset row's category may carry the raw value (legacy aggregate path)
    // or the resolved label (server-resolved dataset dimensions), so both work.
    expect(buildOptionColorMap(health)).toEqual({
      green: '#10B981', Green: '#10B981',
      yellow: '#F59E0B', Yellow: '#F59E0B',
      red: '#EF4444', Red: '#EF4444',
    });
  });

  it('returns null when the field has no options', () => {
    expect(buildOptionColorMap(undefined)).toBeNull();
    expect(buildOptionColorMap(null)).toBeNull();
    expect(buildOptionColorMap([])).toBeNull();
  });

  it('returns null when no option carries a color', () => {
    expect(buildOptionColorMap([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }])).toBeNull();
  });

  it('keeps only the options that carry a color', () => {
    expect(buildOptionColorMap([{ value: 'a', color: '#111' }, { value: 'b' }])).toEqual({ a: '#111' });
  });

  it('ignores non-string colors and malformed entries', () => {
    expect(
      buildOptionColorMap([
        { value: 'a', color: 123 },
        { value: 'b', color: '' },
        null,
        'not-an-object',
        { value: 'c', color: '#0f0' },
      ]),
    ).toEqual({ c: '#0f0' });
  });
});

describe('buildDimensionLabelMap', () => {
  // The AI-build default: English stored `value` + localized display `label`.
  const status = [
    { value: 'active', label: '合作中' },
    { value: 'lost', label: '已流失' },
    { value: 'potential', label: '潜在' },
  ];

  it('maps each option value to its display label', () => {
    expect(buildDimensionLabelMap(status)).toEqual({
      active: '合作中',
      lost: '已流失',
      potential: '潜在',
    });
  });

  it('drops no-op entries where the label equals the value (and bare strings)', () => {
    // A select whose value IS its label needs no relabeling, so it must not
    // appear in the map — that is what makes relabelDimensions idempotent.
    expect(buildDimensionLabelMap([{ value: 'open', label: 'open' }, 'closed'])).toBeNull();
  });

  it('returns null for empty / missing / malformed options', () => {
    expect(buildDimensionLabelMap(undefined)).toBeNull();
    expect(buildDimensionLabelMap(null)).toBeNull();
    expect(buildDimensionLabelMap([])).toBeNull();
    expect(buildDimensionLabelMap([{ value: 'a' }, { label: 'b' }, null])).toBeNull();
  });
});

describe('relabelDimensions', () => {
  const maps = { status: { active: '合作中', lost: '已流失', potential: '潜在' } };

  it('replaces a select dimension value with its label, keeping the measure attached', () => {
    const rows = [
      { status: 'active', count: 6 },
      { status: 'lost', count: 2 },
      { status: 'potential', count: 4 },
    ];
    expect(relabelDimensions(rows, maps)).toEqual([
      { status: '合作中', count: 6 },
      { status: '已流失', count: 2 },
      { status: '潜在', count: 4 },
    ]);
  });

  it('does not mutate the input rows (raw values survive for drill-through)', () => {
    const rows = [{ status: 'active', count: 6 }];
    relabelDimensions(rows, maps);
    expect(rows[0].status).toBe('active');
  });

  it('passes through values with no mapping (already a label, lookup id, free text)', () => {
    // Idempotent: running it again on already-resolved labels is a no-op.
    const rows = [{ status: '合作中', count: 6 }, { status: 'archived', count: 1 }];
    expect(relabelDimensions(rows, maps)).toEqual(rows);
  });

  it('is a no-op when there is no label map', () => {
    const rows = [{ status: 'active', count: 6 }];
    expect(relabelDimensions(rows, null)).toBe(rows);
    expect(relabelDimensions(rows, {})).toBe(rows);
  });

  it('tolerates null/undefined rows', () => {
    expect(relabelDimensions(null, maps)).toEqual([]);
    expect(relabelDimensions(undefined, maps)).toEqual([]);
  });
});

describe('relabelDimensions + buildChartSeries (the value≠label chart bug, cloud#667)', () => {
  // A select field whose stored value is English and whose option label is
  // Chinese — the default product of the AI build agent. The dataset groups by
  // the stored VALUE (active/lost/potential), counts correct. Before the fix
  // the chart axis read those raw values; the requirement is that the chart
  // displays the LABEL while every count still lands on the right category.
  const options = [
    { value: 'active', label: '合作中' },
    { value: 'lost', label: '已流失' },
    { value: 'potential', label: '潜在' },
  ];
  const labelMaps = { status: buildDimensionLabelMap(options)! };

  it('single dimension: counts land on label-keyed categories (no bar reads 0)', () => {
    const valueKeyedRows = [
      { status: 'active', count: 6 },
      { status: 'lost', count: 2 },
      { status: 'potential', count: 4 },
    ];
    const { data, xAxisKey, series } = buildChartSeries(
      relabelDimensions(valueKeyedRows, labelMaps),
      ['status'],
      ['count'],
    );
    expect(xAxisKey).toBe('status');
    expect(series).toEqual([{ dataKey: 'count', label: 'count' }]);
    // Each category displays the label AND keeps its count (the chart reads
    // data[i][xAxisKey] for the bar label and data[i][series.dataKey] for the
    // height) — the exact mismatch that previously zeroed every bar.
    expect(data).toEqual([
      { status: '合作中', count: 6 },
      { status: '已流失', count: 2 },
      { status: '潜在', count: 4 },
    ]);
    const byCategory = Object.fromEntries(data.map((r) => [r.status, r.count]));
    expect(byCategory).toEqual({ 合作中: 6, 已流失: 2, 潜在: 4 });
  });

  it('two dimensions: the pivoted grouped series read labels with counts intact', () => {
    // month × status grouped count — status is the second (pivoted) dimension.
    const rows = [
      { month: '2025-01', status: 'active', count: 5 },
      { month: '2025-01', status: 'lost', count: 1 },
      { month: '2025-02', status: 'active', count: 7 },
    ];
    const { data, xAxisKey, series } = buildChartSeries(
      relabelDimensions(rows, labelMaps),
      ['month', 'status'],
      ['count'],
    );
    expect(xAxisKey).toBe('month');
    // Series (the second dimension) are keyed AND labeled by the display label,
    // so the legend reads 合作中/已流失 and the pivoted column lookup matches.
    expect(series).toEqual([
      { dataKey: '合作中', label: '合作中' },
      { dataKey: '已流失', label: '已流失' },
    ]);
    expect(data).toEqual([
      { month: '2025-01', 合作中: 5, 已流失: 1 },
      { month: '2025-02', 合作中: 7 },
    ]);
  });
});
