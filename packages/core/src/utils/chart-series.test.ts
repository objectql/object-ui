import { describe, it, expect } from 'vitest';
import { buildChartSeries } from './chart-series';

describe('buildChartSeries (#1759)', () => {
  it('single dimension + single measure → x-axis = dim, one series = measure', () => {
    const rows = [
      { status: 'Backlog', est_hours: 5 },
      { status: 'Done', est_hours: 24 },
    ];
    const r = buildChartSeries(rows, ['status'], ['est_hours']);
    expect(r.xAxisKey).toBe('status');
    expect(r.series).toEqual([{ dataKey: 'est_hours', label: 'est_hours' }]);
    expect(r.data).toEqual(rows);
  });

  it('uses field label for measure series when provided', () => {
    const r = buildChartSeries([], ['status'], ['est_hours'], [{ name: 'est_hours', label: 'Estimated Hours' }]);
    expect(r.series).toEqual([{ dataKey: 'est_hours', label: 'Estimated Hours' }]);
  });

  it('single dimension + multiple measures → series per measure (no pivot)', () => {
    const rows = [{ status: 'Done', a: 1, b: 2 }];
    const r = buildChartSeries(rows, ['status'], ['a', 'b']);
    expect(r.xAxisKey).toBe('status');
    expect(r.series.map((s) => s.dataKey)).toEqual(['a', 'b']);
    expect(r.data).toEqual(rows);
  });

  it('two dimensions + single measure → pivots second dim into series', () => {
    const rows = [
      { status: 'Backlog', priority: 'High', est_hours: 5 },
      { status: 'Backlog', priority: 'Low', est_hours: 3 },
      { status: 'Done', priority: 'High', est_hours: 24 },
    ];
    const r = buildChartSeries(rows, ['status', 'priority'], ['est_hours']);
    expect(r.xAxisKey).toBe('status');
    // one series per distinct priority, in first-seen order
    expect(r.series).toEqual([
      { dataKey: 'High', label: 'High' },
      { dataKey: 'Low', label: 'Low' },
    ]);
    // wide-format: one row per status, a column per priority holding the measure
    expect(r.data).toEqual([
      { status: 'Backlog', High: 5, Low: 3 },
      { status: 'Done', High: 24 },
    ]);
  });

  it('tolerates empty / nullish input', () => {
    const r = buildChartSeries(null, null, null);
    expect(r.data).toEqual([]);
    expect(r.xAxisKey).toBeUndefined();
    expect(r.series).toEqual([]);
  });
});
