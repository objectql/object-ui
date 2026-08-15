/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Doc-truth pin: a combo chart's `ComposedChart` branch returns before
 * `cartesianClickProps` is ever built (see `onChartClick`'s doc comment on
 * `AdvancedChartImplProps`), so no click on a combo mark reaches
 * `onChartClick` today — not the mark handler, not the axis handler. This
 * file pins that state as it actually is, for both an EXPLICITLY authored
 * combo and one DERIVED from mixed series families, and carries a positive
 * control in the same file: an identically-shaped click on a plain bar chart
 * DOES reach `onChartClick`, so the "not called" assertions below are proof
 * of the combo branch's silence rather than of a broken click harness.
 *
 * Whether combo SHOULD drill is a product question this file takes no
 * position on (see the linked issue) — it only pins what the renderer does
 * today, so a future change to that answer has to touch this file on
 * purpose rather than drift past it unnoticed.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { ChartSegmentClickEvent } from '@object-ui/core';

// Recharts' ResponsiveContainer measures via ResizeObserver, which reports
// 0x0 under the headless DOM, so nothing paints. Fix its size.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 480, height: 320 }),
  };
});

import AdvancedChartImpl from './AdvancedChartImpl';

afterEach(cleanup);

/**
 * recharts throttles pointer moves through `requestAnimationFrame`, and a
 * click reads the tooltip state that move left behind — the same idiom the
 * sibling click-payload test files use.
 */
const flushFrame = async () => {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};

const clickAt = async (el: Element, clientX: number, clientY: number) => {
  fireEvent.mouseMove(el, { clientX, clientY });
  await flushFrame();
  fireEvent.click(el, { clientX, clientY });
  await flushFrame();
};

const clickRect = async (rect: Element) => {
  const x = Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2;
  const y = Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 2;
  await clickAt(rect, x, y);
};

const DATA = [
  { month: 'Jan', revenue: 120, margin: 0.4 },
  { month: 'Feb', revenue: 80, margin: 0.9 },
];

describe('AdvancedChartImpl — combo has no click wiring today (doc-truth pin)', () => {
  it('fires nothing for a click on an EXPLICITLY authored combo\'s bar mark', async () => {
    const clicks: ChartSegmentClickEvent[] = [];
    const { container } = render(
      <AdvancedChartImpl
        chartType="combo"
        data={DATA as any}
        xAxisKey="month"
        series={[{ dataKey: 'revenue', chartType: 'bar' }, { dataKey: 'margin', chartType: 'line' }]}
        isAnimationActive={false}
        onChartClick={(ev) => clicks.push(ev)}
      />,
    );

    const bar = container.querySelector('.recharts-bar .recharts-rectangle');
    expect(bar, 'a bar mark must actually render for this click to mean anything').toBeTruthy();
    await clickRect(bar!);

    const line = container.querySelector('.recharts-line-curve');
    expect(line, 'a line mark must actually render for this click to mean anything').toBeTruthy();
    await clickAt(line!, 300, 120);

    // The chart surface itself — an axis-level click — is checked too: combo's
    // `ComposedChart` carries no `onClick` at all, so this is not expected to
    // resolve to a category-only event the way a wired cartesian chart's does.
    const surface = container.querySelector('.recharts-surface')!;
    await clickAt(surface, 200, 30);

    expect(clicks).toHaveLength(0);
  });

  it('fires nothing for a click on a combo DERIVED from mixed series families', async () => {
    // No `chartType: 'combo'` authored here — one series declares `type:
    // 'line'` on an otherwise-bar chart, and `effectiveChartFamily` derives
    // combo from that disagreement. This is the derived-family trap the doc
    // comment now names: an author who only meant to change one series' mark
    // loses drill on the whole chart along with it.
    const clicks: ChartSegmentClickEvent[] = [];
    const { container } = render(
      <AdvancedChartImpl
        chartType="bar"
        data={DATA as any}
        xAxisKey="month"
        series={[{ dataKey: 'revenue' }, { dataKey: 'margin', chartType: 'line' }]}
        isAnimationActive={false}
        onChartClick={(ev) => clicks.push(ev)}
      />,
    );

    // Confirm this really did derive to combo: one bar series, one line
    // series — not two bars, which is what a non-derived read would draw.
    expect(container.querySelectorAll('.recharts-bar').length).toBe(1);
    expect(container.querySelectorAll('.recharts-line').length).toBe(1);

    const bar = container.querySelector('.recharts-bar .recharts-rectangle');
    expect(bar).toBeTruthy();
    await clickRect(bar!);

    expect(clicks).toHaveLength(0);
  });

  it('POSITIVE CONTROL: the identically-shaped click DOES fire on a plain (non-combo) bar chart', async () => {
    // Same data, same click helper, same mark shape as the first case above —
    // only the family differs (mixed -> combo vs. uniform -> bar). If this
    // control failed too, the "not called" assertions above would be
    // meaningless: they would just mean the click harness is broken, not
    // that combo specifically has no wiring.
    const clicks: ChartSegmentClickEvent[] = [];
    const { container } = render(
      <AdvancedChartImpl
        chartType="bar"
        data={DATA as any}
        xAxisKey="month"
        series={[{ dataKey: 'revenue' }]}
        isAnimationActive={false}
        onChartClick={(ev) => clicks.push(ev)}
      />,
    );

    const bar = container.querySelector('.recharts-bar .recharts-rectangle');
    expect(bar).toBeTruthy();
    await clickRect(bar!);

    expect(clicks).toHaveLength(1);
    expect(clicks[0].category).toBe('Jan');
    expect(clicks[0].series).toBe('revenue');
  });
});
