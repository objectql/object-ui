/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * #2945 — a chart authored in the spec's `series` shape actually plots.
 *
 * `series` is the one binding the spec shape and the renderer's internal shape
 * spell with the same key. `ChartRenderer` applied the blanket "internal props
 * win" rule to it, so a spec author's `[{ name }]` shadowed the normalized
 * `[{ dataKey }]` and reached a renderer that reads `dataKey` — the chart drew
 * NOTHING. Every other spec binding has a distinct name (`xAxis` vs `xAxisKey`),
 * which is why only this one broke, and why the isolated
 * `normalizeChartSchema` unit tests could all pass while this path was dead.
 *
 * These go through `ChartRenderer` on purpose: the translation was already
 * covered, the handoff was not.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

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

import { ChartRenderer } from './ChartRenderer';

afterEach(cleanup);

const DATA = [
  { month: 'Jan', revenue: 120, margin: 40 },
  { month: 'Feb', revenue: 80, margin: 90 },
];

const marks = (c: HTMLElement) => ({
  bars: c.querySelectorAll('.recharts-bar').length,
  lines: c.querySelectorAll('.recharts-line').length,
});

/** `AdvancedChartImpl` is lazy — wait for the real plot, not the skeleton. */
const plotted = async (c: HTMLElement) => {
  await waitFor(() => expect(c.querySelector('.recharts-surface')).toBeTruthy());
  return marks(c);
};

describe('ChartRenderer — the spec `series` shape', () => {
  it('plots a spec-shape series (it used to render nothing at all)', async () => {
    const { container } = render(
      <ChartRenderer
        schema={{
          type: 'chart',
          chartType: 'bar',
          data: DATA,
          xAxis: { field: 'month' },
          series: [{ name: 'revenue' }, { name: 'margin' }],
          isAnimationActive: false,
        }}
      />,
    );
    expect(await plotted(container)).toEqual({ bars: 2, lines: 0 });
  });

  it('honours a spec `series[].type` override end to end', async () => {
    // The two bugs compound: the override was dropped at this handoff, and
    // would have been ignored by the renderer even if it had survived.
    const { container } = render(
      <ChartRenderer
        schema={{
          type: 'chart',
          chartType: 'bar',
          data: DATA,
          xAxis: { field: 'month' },
          series: [{ name: 'revenue' }, { name: 'margin', type: 'line' }],
          isAnimationActive: false,
        }}
      />,
    );
    expect(await plotted(container)).toEqual({ bars: 1, lines: 1 });
  });

  it('leaves an internal-shape series untouched', async () => {
    const { container } = render(
      <ChartRenderer
        schema={{
          type: 'chart',
          chartType: 'bar',
          data: DATA,
          xAxisKey: 'month',
          series: [{ dataKey: 'revenue' }, { dataKey: 'margin', chartType: 'line' }],
          isAnimationActive: false,
        }}
      />,
    );
    expect(await plotted(container)).toEqual({ bars: 1, lines: 1 });
  });

  it('plots a mixed array, where neither shape alone would do', async () => {
    const { container } = render(
      <ChartRenderer
        schema={{
          type: 'chart',
          chartType: 'bar',
          data: DATA,
          xAxisKey: 'month',
          series: [{ dataKey: 'revenue' }, { name: 'margin' }],
          isAnimationActive: false,
        }}
      />,
    );
    expect(await plotted(container)).toEqual({ bars: 2, lines: 0 });
  });

  it('still adapts the Tremor-ish `categories` form', async () => {
    const { container } = render(
      <ChartRenderer
        schema={{
          type: 'chart',
          chartType: 'bar',
          data: DATA,
          index: 'month',
          categories: ['revenue', 'margin'],
          isAnimationActive: false,
        } as any}
      />,
    );
    expect(await plotted(container)).toEqual({ bars: 2, lines: 0 });
  });
});
