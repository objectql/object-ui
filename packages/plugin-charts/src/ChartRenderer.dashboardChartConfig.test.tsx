/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#7016 — the plot-internal half of the dashboard `chartConfig`
 * forwarding, pinned where it can actually be seen.
 *
 * `DatasetWidget` (plugin-dashboard) now lowers the `chartConfig` keys the chart
 * block delivers onto the `{ type: 'chart' }` schema it hands to the renderer.
 * The criterion for lowering a key is that the chart DRAWS it, so each one needs
 * a DOM pin — and the marks below (bars, LabelList, ReferenceLine/Area, Brush)
 * only exist once Recharts has a measured box. `ResponsiveContainer` reports 0×0
 * under the headless DOM and renders no children, and `recharts` resolves inside
 * THIS package alone, so the mock that fixes its size — and therefore this half
 * of the evidence — has to live here.
 *
 * These render `ChartRenderer`, not `AdvancedChartImpl`: `ChartRenderer` is what
 * the ComponentRegistry resolves `type: 'chart'` to, so it is the component the
 * dashboard path actually reaches, and the schema below is byte-for-byte the
 * shape `DatasetWidget` emits (derived `chartType`/`xAxisKey`/`series` +
 * `isAnimationActive: false` + the lowered presentation keys). The seam that
 * produces it is pinned in plugin-dashboard's
 * `DatasetWidget.chartConfig.test.tsx`; together the two close the loop from
 * dashboard metadata to drawn pixels.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';

// Recharts' ResponsiveContainer measures via ResizeObserver, which reports 0×0
// under the headless DOM, so nothing paints. Fix its size.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 480, height: 320 }),
  };
});

// `ChartRenderer` renders its implementation behind
// `React.lazy(() => import('./AdvancedChartImpl'))`. Importing it here — with the
// SAME specifier, so the ESM cache satisfies the lazy factory — pays the recharts
// graph in the import phase, which no test timeout applies to (AGENTS.md §测试纪律).
import './AdvancedChartImpl';
import { ChartRenderer } from './ChartRenderer';

afterEach(cleanup);

/** The implementation is lazy — wait for the real plot, not the skeleton. */
const plotted = async (c: HTMLElement) => {
  await waitFor(() => expect(c.querySelector('.recharts-surface')).toBeTruthy());
  return c;
};

/**
 * The chart schema a dataset-bound dashboard widget emits for
 * `type: 'bar'`, `dimensions: ['status']`, `values: ['total']` — the derived
 * bindings only. Presentation keys are spread in per test, exactly as
 * `DatasetWidget` spreads its `chartConfig` presentation over this object.
 */
const dashboardSchema = (presentation: Record<string, unknown> = {}) => ({
  type: 'chart',
  chartType: 'bar' as const,
  data: [
    { status: 'open', total: 120 },
    { status: 'paid', total: 80 },
  ],
  xAxisKey: 'status',
  series: [{ dataKey: 'total', label: 'Total' }],
  isAnimationActive: false,
  ...presentation,
});

describe('dashboard chartConfig — colors (objectstack#7016)', () => {
  const sectorFills = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('path.recharts-sector')).map((p) => p.getAttribute('fill'));

  it('paints the marks from an array `colors` palette', async () => {
    // A pie draws one mark per CATEGORY, so a positional palette is readable
    // straight off the sectors' fills.
    const { container } = render(
      <ChartRenderer
        schema={dashboardSchema({ chartType: 'pie', colors: ['#111111', '#222222'] }) as any}
      />,
    );
    expect(sectorFills(await plotted(container))).toEqual(['#111111', '#222222']);
  });

  it('paints per-category colours from a record `colors` map, over the palette', async () => {
    // The record arm of `colors` arrives as `categoryColors` (DatasetWidget does
    // the split) and wins per category, which is the precedence the spec's own
    // `colors` field comment states.
    const { container } = render(
      <ChartRenderer
        schema={dashboardSchema({
          chartType: 'pie',
          colors: ['#111111', '#222222'],
          categoryColors: { open: '#10B981', paid: '#EF4444' },
        }) as any}
      />,
    );
    expect(sectorFills(await plotted(container))).toEqual(['#10B981', '#EF4444']);
  });
});

describe('dashboard chartConfig — showDataLabels (objectstack#7016)', () => {
  const labelTexts = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.recharts-label-list text')).map((t) => t.textContent);

  it('prints each point value on the mark when on', async () => {
    const { container } = render(<ChartRenderer schema={dashboardSchema({ showDataLabels: true }) as any} />);
    expect(labelTexts(await plotted(container))).toEqual(['120', '80']);
  });

  it('prints no data labels when off or undeclared', async () => {
    // `plotted` first: an empty label list has to mean "the plot drew and chose
    // not to label", never "nothing rendered yet".
    const { container: off } = render(<ChartRenderer schema={dashboardSchema({ showDataLabels: false }) as any} />);
    expect(labelTexts(await plotted(off))).toEqual([]);
    cleanup();
    const { container: bare } = render(<ChartRenderer schema={dashboardSchema() as any} />);
    expect(labelTexts(await plotted(bare))).toEqual([]);
  });
});

describe('dashboard chartConfig — annotations (objectstack#7016)', () => {
  it('draws a reference line for a line annotation', async () => {
    const { container } = render(
      <ChartRenderer
        schema={dashboardSchema({
          annotations: [{ type: 'line', axis: 'y', value: 100, label: 'Target' }],
        }) as any}
      />,
    );
    await plotted(container);
    expect(container.querySelectorAll('.recharts-reference-line').length).toBeGreaterThan(0);
    expect(screen.getByText('Target')).toBeTruthy();
  });

  it('draws a reference area for a region annotation', async () => {
    const { container } = render(
      <ChartRenderer
        schema={dashboardSchema({
          annotations: [{ type: 'region', axis: 'y', value: 50, endValue: 100 }],
        }) as any}
      />,
    );
    await plotted(container);
    expect(container.querySelectorAll('.recharts-reference-area').length).toBeGreaterThan(0);
  });

  it('draws nothing extra when no annotation is declared', async () => {
    const { container } = render(<ChartRenderer schema={dashboardSchema() as any} />);
    await plotted(container);
    expect(container.querySelectorAll('.recharts-reference-line').length).toBe(0);
    expect(container.querySelectorAll('.recharts-reference-area').length).toBe(0);
  });
});

describe('dashboard chartConfig — interaction (objectstack#7016)', () => {
  it('adds the range selector when interaction.brush is on', async () => {
    const { container } = render(
      <ChartRenderer schema={dashboardSchema({ interaction: { brush: true } }) as any} />,
    );
    await plotted(container);
    expect(container.querySelectorAll('.recharts-brush').length).toBeGreaterThan(0);
  });

  it('omits the range selector by default', async () => {
    const { container } = render(<ChartRenderer schema={dashboardSchema() as any} />);
    await plotted(container);
    expect(container.querySelectorAll('.recharts-brush').length).toBe(0);
  });

  it('removes the hover tooltip when interaction.tooltips is false', async () => {
    // The "on" arm is the control: without it a missing tooltip wrapper would
    // read as honoured when it only meant the plot had not drawn.
    const { container: on } = render(<ChartRenderer schema={dashboardSchema() as any} />);
    await plotted(on);
    expect(on.querySelectorAll('.recharts-tooltip-wrapper').length).toBeGreaterThan(0);
    cleanup();
    const { container: off } = render(
      <ChartRenderer schema={dashboardSchema({ interaction: { tooltips: false } }) as any} />,
    );
    await plotted(off);
    expect(off.querySelectorAll('.recharts-tooltip-wrapper').length).toBe(0);
  });
});

describe('dashboard chartConfig — the keys that stay out (objectstack#7016)', () => {
  // `aria` is declared by ChartConfigSchema and read by NOTHING on this path, so
  // DatasetWidget refuses to lower it. This pins the "read by nothing" half: even
  // handed straight to the renderer the object changes no attribute, which is why
  // forwarding it would only have moved declared-but-inert one layer down.
  it('an `aria` object handed to the chart changes no attribute', async () => {
    const { container } = render(
      <ChartRenderer
        schema={dashboardSchema({
          aria: { ariaLabel: 'Authored name', ariaDescribedBy: 'hint', role: 'figure' },
        }) as any}
      />,
    );
    await plotted(container);
    const chart = container.querySelector('[data-slot="chart"]') as HTMLElement;
    expect(chart.getAttribute('role')).toBeNull();
    expect(chart.getAttribute('aria-label')).toBeNull();
    expect(container.querySelector('[aria-describedby]')).toBeNull();
  });
});
