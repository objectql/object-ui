// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectstack#7016 — the DECISION TABLE for `DashboardWidget.chartConfig`, pinned.
 *
 * `chartConfig` is declared as the full spec `ChartConfigSchema`, but the
 * dashboard dataset path only ever lowered `showLegend` (#3135). This file pins
 * which of the remaining keys now reach the chart schema and which are refused,
 * because the split is a contract, not an implementation detail:
 *
 *  - forwarded, because the chart block measurably draws it (the DOM half of
 *    that claim lives in `DatasetWidget.chartConfig.dom.test.tsx` for the keys
 *    drawn outside the plot and in plugin-charts'
 *    `ChartRenderer.dashboardChartConfig.test.tsx` for the ones drawn inside it):
 *    `title`, `subtitle`, `description`, `height`, `colors`, `showDataLabels`,
 *    `annotations`, `interaction` — beside the pre-existing `showLegend`;
 *  - refused, because the value is DERIVED from the dataset selection and an
 *    authored one would shadow it: `xAxis`, `yAxis`, `series`, `type`;
 *  - refused, because nothing on this path reads it: `aria`.
 *
 * The refusals are pinned as hard as the forwards. Today's behaviour for them is
 * the contract until objectstack#5175's narrowing half rules on the shape, and a
 * silent "improvement" here would pre-empt that decision.
 *
 * Asserted at the source — the schema handed to the renderer — via a stubbed
 * SchemaRenderer, the same seam `DatasetWidget.showLegend`/`.animation` use.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

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

const rows = [
  { status: 'open', total: 120 },
  { status: 'paid', total: 80 },
];

/** Render a dataset chart widget with the given `chartConfig` and settle it. */
const renderWidget = async (chartConfig?: Record<string, unknown>, widgetType = 'bar') => {
  const src = { queryDataset: vi.fn(async () => ({ rows })) };
  render(
    <DatasetWidget
      widget={{
        type: widgetType,
        dataset: 'invoices',
        dimensions: ['status'],
        values: ['total'],
        ...(chartConfig ? { chartConfig } : {}),
      }}
      dataSource={src}
    />,
  );
  await waitFor(() => expect(lastChartSchema).not.toBeNull());
};

describe('DatasetWidget — chartConfig keys that ARE lowered (objectstack#7016)', () => {
  it('forwards the chart titles and the accessibility description', async () => {
    await renderWidget({
      type: 'bar',
      title: 'Invoice value',
      subtitle: 'by status',
      description: 'Invoice value by status',
    });
    expect(lastChartSchema.title).toBe('Invoice value');
    expect(lastChartSchema.subtitle).toBe('by status');
    expect(lastChartSchema.description).toBe('Invoice value by status');
  });

  it('forwards an explicit plot height', async () => {
    await renderWidget({ type: 'bar', height: 420 });
    expect(lastChartSchema.height).toBe(420);
  });

  // A non-positive height would collapse the plot to nothing; the container
  // default is a more honest answer than an invisible chart, so the key is
  // dropped rather than lowered.
  it('drops a non-positive or non-numeric height', async () => {
    await renderWidget({ type: 'bar', height: 0 });
    expect('height' in lastChartSchema).toBe(false);
    cleanup();
    lastChartSchema = null;
    await renderWidget({ type: 'bar', height: -10 });
    expect('height' in lastChartSchema).toBe(false);
  });

  it('forwards showDataLabels in both directions', async () => {
    await renderWidget({ type: 'bar', showDataLabels: true });
    expect(lastChartSchema.showDataLabels).toBe(true);
    cleanup();
    lastChartSchema = null;
    await renderWidget({ type: 'bar', showDataLabels: false });
    expect(lastChartSchema.showDataLabels).toBe(false);
  });

  it('forwards annotations and the interaction toggles', async () => {
    await renderWidget({
      type: 'bar',
      annotations: [{ type: 'line', axis: 'y', value: 100, label: 'Target' }],
      interaction: { tooltips: false, brush: true },
    });
    expect(lastChartSchema.annotations).toEqual([
      { type: 'line', axis: 'y', value: 100, label: 'Target' },
    ]);
    expect(lastChartSchema.interaction).toEqual({ tooltips: false, brush: true });
  });

  it('drops an empty annotations array instead of emitting a dead key', async () => {
    await renderWidget({ type: 'bar', annotations: [] });
    expect('annotations' in lastChartSchema).toBe(false);
  });

  // `colors` is overloaded: a string[] is the positional palette, a
  // { value: color } record is a per-category map. They reach the renderer
  // through two DIFFERENT props, so the widget splits them — the same split the
  // react tier's ObjectChart performs.
  it('lowers an array `colors` as the positional palette', async () => {
    await renderWidget({ type: 'bar', colors: ['#111111', '#222222'] });
    expect(lastChartSchema.colors).toEqual(['#111111', '#222222']);
    expect('categoryColors' in lastChartSchema).toBe(false);
  });

  it('lowers a record `colors` as the per-category map, not as the palette', async () => {
    await renderWidget({ type: 'pie', colors: { open: '#10B981', paid: '#EF4444' } });
    expect(lastChartSchema.categoryColors).toEqual({ open: '#10B981', paid: '#EF4444' });
    expect('colors' in lastChartSchema).toBe(false);
  });

  it('keeps the pre-existing showLegend behaviour (#3135)', async () => {
    await renderWidget({ type: 'bar', showLegend: false });
    expect(lastChartSchema.showLegend).toBe(false);
  });

  // The whole point of a whitelist: an undeclared key leaves the renderer's own
  // default in charge, so every dashboard that never wrote `chartConfig` renders
  // byte-for-byte as before.
  it('emits none of the presentation keys when no chartConfig is declared', async () => {
    await renderWidget();
    for (const key of [
      'title', 'subtitle', 'description', 'height', 'colors', 'categoryColors',
      'showLegend', 'showDataLabels', 'annotations', 'interaction',
    ]) {
      expect({ key, present: key in lastChartSchema }).toEqual({ key, present: false });
    }
  });
});

describe('DatasetWidget — chartConfig keys that are REFUSED (objectstack#7016)', () => {
  // Criterion 2: the axes and the series are derived from the dataset selection
  // (`buildChartSeries`). An authored `xAxis`/`yAxis`/`series` would shadow the
  // derived binding inside `normalizeChartSchema` and blank the chart, so they
  // are not lowered at all. This is the negative pin the issue asks for: the key
  // is written, and it stays ignored.
  it('ignores an authored xAxis / yAxis and keeps the derived axis binding', async () => {
    await renderWidget({
      type: 'bar',
      xAxis: { field: 'not_a_column', title: 'Authored X' },
      yAxis: [{ field: 'not_a_measure', min: 0, max: 5 }],
    });
    expect('xAxis' in lastChartSchema).toBe(false);
    expect('yAxis' in lastChartSchema).toBe(false);
    // The derived binding is untouched: the dimension is still the category axis.
    expect(lastChartSchema.xAxisKey).toBe('status');
  });

  it('ignores an authored series and keeps one derived series per measure', async () => {
    await renderWidget({ type: 'bar', series: [{ name: 'not_a_measure', stack: 'g' }] });
    // `series` on the emitted schema is the DERIVED one (internal `dataKey`
    // shape, one entry per selected measure) — not the authored array.
    expect(lastChartSchema.series).toHaveLength(1);
    expect(lastChartSchema.series[0].dataKey).toBe('total');
    expect(lastChartSchema.series[0].name).toBeUndefined();
    expect(lastChartSchema.series[0].stack).toBeUndefined();
  });

  it('ignores chartConfig.type — the widget type owns the chart family', async () => {
    await renderWidget({ type: 'line' }, 'pie');
    expect(lastChartSchema.chartType).toBe('pie');
    // Neither the author `type` nor its rescued `specType` spelling is lowered,
    // so nothing can outrank CHART_TYPE_MAP.
    expect(lastChartSchema.type).toBe('chart');
    expect('specType' in lastChartSchema).toBe(false);
  });

  // Criterion 1: `aria` is declared by ChartConfigSchema and read by NOTHING on
  // this path — AdvancedChartImpl has no `aria` prop, and SchemaRenderer's ARIA
  // injection reads the FLAT `ariaLabel`/`ariaDescribedBy`/`role`. Forwarding it
  // (nested, or flattened onto those three) would either stay inert or fight the
  // accessible name `description` already sets. It stays out until #5175 rules.
  it('ignores aria — nested and flattened', async () => {
    await renderWidget({
      type: 'bar',
      aria: { ariaLabel: 'Authored name', ariaDescribedBy: 'hint', role: 'figure' },
    });
    for (const key of ['aria', 'ariaLabel', 'ariaDescribedBy', 'role']) {
      expect(key in lastChartSchema).toBe(false);
    }
  });
});
