// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#4229 — an authored `combo` widget renders as a combo on the DATASET
 * path, not as grouped bars.
 *
 * The QA run measured a widget authoring the spec's own combo shape
 * (`series[].type` + `series[].yAxis` + two `yAxis` entries) and got
 * **2 bars / 0 lines / 1 y-axis** where 1 bar + 1 line + 2 axes were authored.
 * Two halves caused it, both in `DatasetWidget`:
 *
 *  1. `CHART_TYPE_MAP` had no `combo` entry, so a `combo` widget fell through
 *     the `?? 'bar'` default — bars, whatever the series said;
 *  2. `chartConfigPresentation` refused to forward `series`/`xAxis`/`yAxis` at
 *     all, on the grounds that they are "derived from the dataset selection" —
 *     so the per-series mark and the left/right axis binding could never reach
 *     the renderer even once (1) was fixed.
 *
 * The ruling that settles who owns what: **the dataset owns DATA (series
 * membership, the column each binding reads), the author owns PRESENTATION
 * (mark, axis binding, scale, chrome), merged forward by name/key with the
 * explicit binding winning.** That is objectui#2880's S2 rule — dual axes are
 * `yAxis[].position` plus `series[].yAxis`, and a combo binds its axes by
 * explicit binding first rather than by the implicit per-series-type guess —
 * which PR #2883 landed in `ObjectChart` and which the dataset path never
 * carried over.
 *
 * ## Where this stops, and why
 *
 * These assertions stop at the shape handed to the renderer, one step past the
 * seam: they run the emitted schema through `normalizeChartSchema`, the ONE
 * translation layer `ChartRenderer` puts between the schema and
 * `AdvancedChartImpl` (#2880 S1), so what is pinned is what the renderer
 * actually receives — not merely what this widget wrote down.
 *
 * They do NOT count recharts marks. That needs `ResponsiveContainer` mocked to
 * a measured box, and `recharts` resolves inside `plugin-charts` alone (the
 * same constraint `DatasetWidget.chartConfig.dom.test.tsx` records) — a
 * `vi.mock('recharts')` in THIS package cannot even resolve the specifier. The
 * mark half is already pinned there, against the exact shape asserted below:
 * `AdvancedChartImpl.comboFromSeries.test.tsx` draws a `chartType: 'line'`
 * series as a line and binds `yAxis: 'right'` to the right axis, and the combo
 * branch renders both y-axes unconditionally.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
// The renderer's own translation layer, imported read-only so these assertions
// are made against what `AdvancedChartImpl` receives rather than a restatement
// of it. `plugin-charts` is a devDependency of this package, and this is its
// PUBLISHED root entry — the same module `ChartRenderer` calls, reached the way
// any consumer outside this repo would reach it (objectui#4529).
import { normalizeChartSchema } from '@object-ui/plugin-charts';

let lastChartSchema: any = null;

vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  SchemaRenderer: (props: any) => {
    lastChartSchema = props.schema;
    return null;
  },
}));

import { DatasetWidget } from '../DatasetWidget';

afterEach(() => {
  cleanup();
  lastChartSchema = null;
});

/** The card's fixture: a count and a percentage that must not share an axis. */
const rows = [
  { assignee: 'ann', task_count: 12, avg_progress: 64 },
  { assignee: 'bob', task_count: 7, avg_progress: 88 },
];

const fields = [
  { name: 'assignee', label: 'Assignee' },
  { name: 'task_count', label: 'Tasks' },
  { name: 'avg_progress', label: 'Avg progress' },
];

/** `combo_count_vs_progress` as the QA run authored it. */
const comboChartConfig = {
  series: [
    { name: 'task_count', type: 'bar', yAxis: 'left' },
    { name: 'avg_progress', type: 'line', yAxis: 'right' },
  ],
  yAxis: [
    { field: 'task_count', title: 'Tasks' },
    { field: 'avg_progress', title: 'Avg progress', position: 'right', min: 0, max: 100 },
  ],
};

const renderWidget = async (widget: Record<string, unknown>) => {
  const src = { queryDataset: vi.fn(async () => ({ rows, fields })) };
  render(<DatasetWidget widget={widget} dataSource={src} />);
  await waitFor(() => expect(lastChartSchema).not.toBeNull());
};

const comboWidget = (overrides: Record<string, unknown> = {}) => ({
  type: 'combo',
  dataset: 'tasks',
  dimensions: ['assignee'],
  values: ['task_count', 'avg_progress'],
  chartConfig: comboChartConfig,
  ...overrides,
});

/**
 * What `AdvancedChartImpl` is handed for the two bindings this card is about.
 *
 * `series` is read verbatim: `ChartRenderer` forwards an array that already
 * speaks the internal (`dataKey`) shape untouched, and this widget's does.
 * `yAxes` is the normalized form of the authored `yAxis`.
 */
const asRenderer = (schema: any) => ({
  chartType: schema.chartType ?? normalizeChartSchema(schema).chartType,
  series: schema.series,
  yAxes: normalizeChartSchema(schema).yAxes,
  xAxisKey: schema.xAxisKey ?? normalizeChartSchema(schema).xAxisKey,
});

describe('DatasetWidget — an authored combo reaches the renderer as a combo (#4229)', () => {
  // Half 1. `combo` is a `ChartTypeSchema` member since spec 17.0.0-rc.1 and the
  // renderer draws it distinctly, so it maps to itself instead of falling
  // through the `?? 'bar'` default that produced the measured bars.
  it('resolves the `combo` family instead of falling through to bar', async () => {
    await renderWidget(comboWidget());
    expect(asRenderer(lastChartSchema).chartType).toBe('combo');
  });

  // Half 2, the mark: `series[].type` is presentation and merges onto the
  // derived binding. Without it the line measure drew as the second bar.
  it('merges the authored per-series mark onto the derived series', async () => {
    await renderWidget(comboWidget());
    const { series } = asRenderer(lastChartSchema);
    expect(series.map((s: any) => [s.dataKey, s.chartType])).toEqual([
      ['task_count', 'bar'],
      ['avg_progress', 'line'],
    ]);
    // The label still comes from the dataset field, not from the author's entry
    // (which declared none) — membership and its labelling stay derived.
    expect(series.map((s: any) => s.label)).toEqual(['Tasks', 'Avg progress']);
  });

  // Half 2, the axes: two declared entries are what turn on the secondary axis,
  // and `series[].yAxis` is what binds a measure to it. The percentage measure
  // must not be plotted against the count's scale.
  it('declares two y-axes and binds each series to the authored one', async () => {
    await renderWidget(comboWidget());
    const { series, yAxes } = asRenderer(lastChartSchema);
    expect(series.map((s: any) => s.yAxis)).toEqual(['left', 'right']);
    expect(yAxes).toHaveLength(2);
    expect(yAxes?.[1].position).toBe('right');
    // The axis presentation travels with it: the percentage axis is pinned to
    // 0–100 rather than sharing the count's auto domain.
    expect(yAxes?.[1].min).toBe(0);
    expect(yAxes?.[1].max).toBe(100);
    expect(yAxes?.map((a: any) => a.title)).toEqual(['Tasks', 'Avg progress']);
  });

  // The membership pin. An authored entry naming a measure the dataset did not
  // select is IGNORED — it cannot add a series, and it cannot re-point one.
  it('ignores an authored series naming a measure outside the selection', async () => {
    await renderWidget(
      comboWidget({
        chartConfig: {
          series: [
            { name: 'avg_progress', type: 'line', yAxis: 'right' },
            { name: 'not_a_measure', type: 'line', yAxis: 'right', color: '#ff0000' },
          ],
        },
      }),
    );
    const { series } = asRenderer(lastChartSchema);
    expect(series.map((s: any) => s.dataKey)).toEqual(['task_count', 'avg_progress']);
    expect(series.some((s: any) => s.color === '#ff0000')).toBe(false);
  });

  // The control on the other side of the match: a derived series the author
  // said nothing about carries no presentation at all, so the renderer's family
  // default decides its mark — `chartType` is absent, not defaulted here.
  it('leaves a derived series with no authored entry untouched', async () => {
    await renderWidget(
      comboWidget({ chartConfig: { series: [{ name: 'avg_progress', type: 'line', yAxis: 'right' }] } }),
    );
    const { series } = asRenderer(lastChartSchema);
    expect(series[0]).toEqual({ dataKey: 'task_count', label: 'Tasks' });
    expect(series[1]).toMatchObject({ dataKey: 'avg_progress', chartType: 'line', yAxis: 'right' });
  });

  // `ChartAxis.field` is the one DATA key on an axis — it names the plotted
  // column — so it does not travel, and the derived category binding is what
  // the renderer keeps. This is what makes forwarding the axes safe: with
  // `field` gone there is no channel by which an authored axis could name a
  // series (`normalizeChartSchema` synthesises series from `yAxis[].field`).
  it('does not let an authored axis `field` reach the renderer', async () => {
    await renderWidget(
      comboWidget({
        chartConfig: {
          xAxis: { field: 'not_a_column', title: 'By assignee' },
          yAxis: [{ field: 'not_a_measure', title: 'Tasks' }],
        },
      }),
    );
    const schema = lastChartSchema;
    expect(schema.xAxis).toEqual({ title: 'By assignee' });
    expect(schema.yAxis).toEqual([{ title: 'Tasks' }]);
    // The derived bindings are untouched.
    expect(asRenderer(schema).xAxisKey).toBe('assignee');
    expect(asRenderer(schema).series.map((s: any) => s.dataKey)).toEqual(['task_count', 'avg_progress']);
  });

  // A second `yAxis` entry that carries nothing but its own existence still
  // declares the secondary axis — the COUNT is presentation, and stripping
  // `field` must not collapse it (`hasDualAxis` is `yAxes.length > 1`).
  it('keeps an axis slot that declared only its `field`', async () => {
    await renderWidget(
      comboWidget({ chartConfig: { yAxis: [{ field: 'task_count' }, { field: 'avg_progress' }] } }),
    );
    expect(asRenderer(lastChartSchema).yAxes).toHaveLength(2);
  });

  // A `type` the renderer cannot compose on one cartesian plot is dropped
  // rather than passed through: as `chartType` it would count as a family
  // disagreement, flip the chart into a combo, and then draw as a bar anyway.
  it('drops a per-series type that is not bar/line/area', async () => {
    await renderWidget(
      comboWidget({ chartConfig: { series: [{ name: 'avg_progress', type: 'pie' }] } }),
    );
    expect('chartType' in asRenderer(lastChartSchema).series[1]).toBe(false);
  });
});

describe('DatasetWidget — the merge is presentation-only (#4229 controls)', () => {
  // The guard against the merge forwarding stale keys the old code stripped:
  // a widget that authors no chartConfig emits exactly what it emitted before.
  it('emits no axis keys and a byte-identical derived series when nothing is authored', async () => {
    await renderWidget({
      type: 'bar',
      dataset: 'tasks',
      dimensions: ['assignee'],
      values: ['task_count', 'avg_progress'],
    });
    expect('xAxis' in lastChartSchema).toBe(false);
    expect('yAxis' in lastChartSchema).toBe(false);
    expect(lastChartSchema.chartType).toBe('bar');
    expect(lastChartSchema.series).toEqual([
      { dataKey: 'task_count', label: 'Tasks' },
      { dataKey: 'avg_progress', label: 'Avg progress' },
    ]);
  });

  // The same for a chartConfig that declares only chrome: the chrome lowers
  // (objectstack#7016) and the bindings stay derived.
  it('leaves the bindings alone for a chartConfig that declares only chrome', async () => {
    await renderWidget({
      type: 'line',
      dataset: 'tasks',
      dimensions: ['assignee'],
      values: ['task_count'],
      chartConfig: { title: 'Tasks by assignee', showLegend: false },
    });
    expect(lastChartSchema.title).toBe('Tasks by assignee');
    expect(lastChartSchema.showLegend).toBe(false);
    expect('xAxis' in lastChartSchema).toBe(false);
    expect('yAxis' in lastChartSchema).toBe(false);
    expect(lastChartSchema.series).toEqual([{ dataKey: 'task_count', label: 'Tasks' }]);
  });

  // A non-combo family gains the same merge — `series[].type` is how the spec
  // says "this one measure is a line", and #2945 already taught the renderer to
  // DERIVE a combo from that disagreement. The dataset path now delivers it.
  it('lets a bar widget declare one line series (a derived combo)', async () => {
    await renderWidget({
      type: 'bar',
      dataset: 'tasks',
      dimensions: ['assignee'],
      values: ['task_count', 'avg_progress'],
      chartConfig: { series: [{ name: 'avg_progress', type: 'line', yAxis: 'right' }] },
    });
    const { chartType, series } = asRenderer(lastChartSchema);
    // The widget's own family is unchanged — the renderer derives the combo.
    expect(chartType).toBe('bar');
    expect(series[1]).toMatchObject({ chartType: 'line', yAxis: 'right' });
  });
});

describe('DatasetWidget — a comparison overlay follows its own measure (#4229)', () => {
  // `compareTo` adds one overlay series per compared measure. It is the SAME
  // measure a period back, so it has to take that measure's merged mark and
  // axis; left to the renderer's positional guess, the overlay of a bar/left
  // measure drew as a line on the right axis the moment the chart became a
  // combo.
  it('gives each overlay the mark and axis of the series it overlays', async () => {
    const src = {
      queryDataset: vi.fn(async () => ({
        rows: rows.map((r) => ({ ...r, task_count__compare: 9, avg_progress__compare: 55 })),
        fields,
      })),
    };
    render(
      <DatasetWidget
        widget={comboWidget({ compareTo: { kind: 'previousYear' } })}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(lastChartSchema).not.toBeNull());

    const series = lastChartSchema.series;
    expect(series.map((s: any) => s.dataKey)).toEqual([
      'task_count', 'avg_progress', 'task_count__compare', 'avg_progress__compare',
    ]);
    expect(series.slice(2).map((s: any) => [s.chartType, s.yAxis, s.variant])).toEqual([
      ['bar', 'left', 'comparison'],
      ['line', 'right', 'comparison'],
    ]);
    // Stacking is NOT inherited: an overlay stacked onto its own primary would
    // add the two periods together.
    expect(series.every((s: any) => s.stack === undefined)).toBe(true);
  });
});
