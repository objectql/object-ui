/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression: a dataset-bound chart's aggregate MEASURE (e.g. `task_count`)
 * rendered as its raw field name in the legend/tooltip — even though the
 * dataset's `queryDataset()` response carries a human `label` ("Tasks") for
 * every measure field, and `buildChartSeries()` already resolves that label
 * when given a `fields` array (see chart-series.test.ts). `ObjectChart`'s
 * dataset-bound fetch path discarded `res.fields` before it ever reached
 * `buildChartSeries()`, so the lookup always fell back to the raw name.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 480, height: 320 }),
  };
});

import { ObjectChart } from './ObjectChart';

afterEach(cleanup);

const makeDS = () => ({
  queryDataset: vi.fn().mockResolvedValue({
    rows: [{ status: 'todo', task_count: 3 }],
    fields: [
      { name: 'status', label: 'Status' },
      { name: 'task_count', label: 'Tasks' },
    ],
  }),
});

describe('ObjectChart — dataset-bound measure label resolution', () => {
  it('renders the resolved measure label ("Tasks"), not the raw field name ("task_count")', async () => {
    const ds = makeDS();
    const { container } = render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          dataset: 'showcase_task_metrics',
          dimensions: ['status'],
          values: ['task_count'],
        }}
        dataSource={ds}
      />,
    );

    await waitFor(() => expect(ds.queryDataset).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain('Tasks'));
    // Exclude the injected scoped-style <style> tag: it legitimately declares
    // a `--color-task_count` CSS custom property keyed by the raw field name
    // (harmless, invisible) — the regression this guards is the raw name
    // leaking into user-visible text (legend/tooltip), not into CSS var names.
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll('style').forEach((el) => el.remove());
    expect(visible.textContent).not.toContain('task_count');
  });
});
