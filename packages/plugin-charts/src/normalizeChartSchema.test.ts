/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * The spec→internal chart translation (objectui#2880 S1, framework#3729).
 *
 * Two invariants carry the whole design:
 *   1. an author writing the SPEC shape gets a working chart, and
 *   2. a caller already speaking the INTERNAL shape is byte-for-byte untouched
 *      (DashboardRenderer / ObjectView / the dataset path pass it explicitly).
 */
import { describe, it, expect } from 'vitest';
import { normalizeChartSchema, formatterFor, domainFor } from './normalizeChartSchema';

describe('normalizeChartSchema — spec shape', () => {
  it('resolves the ChartConfig axis + series shape', () => {
    const out = normalizeChartSchema({
      type: 'line',
      xAxis: { field: 'status' },
      yAxis: [{ field: 'total' }],
      series: [{ name: 'total', label: 'Invoice value' }],
    });
    expect(out.chartType).toBe('line');
    expect(out.xAxisKey).toBe('status');
    expect(out.series).toEqual([{ dataKey: 'total', label: 'Invoice value' }]);
  });

  it('plots from yAxis alone when no series is declared', () => {
    const out = normalizeChartSchema({ xAxis: { field: 'status' }, yAxis: [{ field: 'total' }] });
    expect(out.series).toEqual([{ dataKey: 'total' }]);
  });

  it('accepts the report surface’s bare-string axes', () => {
    // ReportChartSchema narrows xAxis/yAxis from objects to plain strings.
    const out = normalizeChartSchema({ xAxis: 'status', yAxis: 'total' });
    expect(out.xAxisKey).toBe('status');
    expect(out.series).toEqual([{ dataKey: 'total' }]);
  });

  it('carries the axis presentation props through', () => {
    const out = normalizeChartSchema({
      yAxis: [{ field: 'total', format: '$0,0.00', min: 0, max: 100, logarithmic: true, title: 'Revenue' }],
    });
    expect(out.yAxes?.[0]).toMatchObject({
      field: 'total', format: '$0,0.00', min: 0, max: 100, logarithmic: true, title: 'Revenue',
    });
  });

  it('carries stack / yAxis / color on a series', () => {
    const out = normalizeChartSchema({
      series: [
        { name: 'won', stack: 'deals', color: 'green' },
        { name: 'rate', yAxis: 'right', type: 'line' },
      ],
    });
    expect(out.series?.[0]).toMatchObject({ dataKey: 'won', stack: 'deals', color: 'green' });
    expect(out.series?.[1]).toMatchObject({ dataKey: 'rate', yAxis: 'right', chartType: 'line' });
  });

  it('resolves an i18n label record to a string', () => {
    const out = normalizeChartSchema({ title: { 'zh-CN': '发票金额', en: 'Invoice value' } });
    expect(typeof out.title).toBe('string');
    expect(out.title).toBeTruthy();
  });

  it('passes chrome + annotations + interaction through', () => {
    const out = normalizeChartSchema({
      showLegend: false,
      showDataLabels: true,
      annotations: [{ type: 'line', axis: 'y', value: 100 }],
      interaction: { tooltips: false, brush: true },
    });
    expect(out.showLegend).toBe(false);
    expect(out.showDataLabels).toBe(true);
    expect(out.annotations).toHaveLength(1);
    expect(out.interaction).toEqual({ tooltips: false, brush: true });
  });
});

describe('normalizeChartSchema — internal shape wins', () => {
  it('keeps explicit internal props over the spec ones', () => {
    // The no-migration guarantee: DashboardRenderer/ObjectView/dataset callers
    // pass the internal shape and must be unaffected by this layer.
    const out = normalizeChartSchema({
      chartType: 'bar',
      xAxisKey: 'stage',
      series: [{ dataKey: 'amount' }],
      type: 'line',
      xAxis: { field: 'status' },
    });
    expect(out.chartType).toBe('bar');
    expect(out.xAxisKey).toBe('stage');
    expect(out.series).toEqual([{ dataKey: 'amount' }]);
  });

  it('returns nothing for a schema with no chart binding at all', () => {
    expect(normalizeChartSchema({ objectName: 'invoice' })).toEqual({});
    expect(normalizeChartSchema(null)).toEqual({});
  });
});

describe('normalizeChartSchema — the `type` collision', () => {
  it('does NOT read a component discriminator as a chart family', () => {
    // `object-chart` is the SDUI component type, not a chart family — reading
    // it as one would render a bar chart for every block on the page.
    expect(normalizeChartSchema({ type: 'object-chart' }).chartType).toBeUndefined();
  });

  it('reads `specType`, where the react-page wrapper parks an author `type`', () => {
    expect(normalizeChartSchema({ type: 'object-chart', specType: 'donut' }).chartType).toBe('donut');
  });

  it('leaves a family this renderer cannot draw unset', () => {
    // `metric`/`kpi` are single-value families rendered by other components;
    // mapping them onto a bar chart would draw the wrong picture silently.
    expect(normalizeChartSchema({ specType: 'metric' }).chartType).toBeUndefined();
  });
});

describe('formatterFor', () => {
  it('formats currency', () => {
    expect(formatterFor('$0,0.00')!(1234.5)).toMatch(/1,234\.50/);
  });

  it('formats percent', () => {
    expect(formatterFor('0.0%')!(0.256)).toMatch(/25\.6%/);
  });

  it('groups thousands', () => {
    expect(formatterFor('0,0')!(1234567)).toMatch(/1,234,567/);
  });

  it('returns undefined for an unrecognized format so the caller keeps its default', () => {
    expect(formatterFor(undefined)).toBeUndefined();
    expect(formatterFor('wat')).toBeUndefined();
  });

  it('passes non-numeric values through instead of printing NaN', () => {
    expect(formatterFor('$0,0.00')!('n/a')).toBe('n/a');
  });
});

describe('domainFor', () => {
  it('pins both ends', () => {
    expect(domainFor({ min: 0, max: 100 })).toEqual([0, 100]);
  });

  it('leaves the unspecified end automatic', () => {
    expect(domainFor({ min: 0 })).toEqual([0, 'auto']);
    expect(domainFor({ max: 100 })).toEqual(['auto', 100]);
  });

  it('returns undefined when neither end is set', () => {
    expect(domainFor({})).toBeUndefined();
    expect(domainFor(undefined)).toBeUndefined();
  });
});
