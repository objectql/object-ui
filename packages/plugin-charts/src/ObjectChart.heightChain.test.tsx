/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#5451 — the height chain through ObjectChart's wrapper.
 *
 * A dashboard grid cell declares a definite height and sends
 * `className: "h-full"` down the widget schema; that class lands on
 * ChartContainer, whose `height: 100%` resolves against ObjectChart's OWN
 * wrapper div. When that wrapper is a plain auto-height block the chain dies
 * there: the container computes to `auto`, recharts measures a permanent
 * zero, and only the CHART_MIN_HEIGHT floor (#5503) keeps the chart from
 * rendering blank — at a fixed floor height instead of filling the cell.
 *
 * Pinned here: the wrapper carries `h-full` so a parent-declared height
 * actually reaches the measured element. (Under auto-height parents `h-full`
 * resolves to `auto`, so non-dashboard hosts are unaffected — that is why
 * this is safe unconditionally.)
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('./ChartRenderer', () => ({
  ChartRenderer: () => null,
}));

import { ObjectChart } from './ObjectChart';

afterEach(() => {
  cleanup();
});

describe('ObjectChart wrapper height chain (objectui#5451)', () => {
  it('the wrapper div propagates parent height (h-full), so a grid cell height reaches ChartContainer', () => {
    const { container } = render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          objectName: 'task',
          xAxisKey: 'status',
          className: 'h-full',
          data: [{ status: 'open', count: 3 }],
        }}
        dataSource={{ find: async () => ({ data: [] }) }}
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.className).toContain('h-full');
  });
});
