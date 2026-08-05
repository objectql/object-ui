/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * `DrillDownConfig.target` on ObjectChart (objectui#3354).
 *
 * The shared `DrillDownConfig` promises three targets, and `DrillDownDrawer`
 * (plugin-dashboard) delivers all three for the table / pivot / metric widgets.
 * ObjectChart draws its OWN drawer and used to branch on `'dialog'` only, so
 * `target: 'navigate'` fell through to the default Sheet — silently identical
 * to `'drawer'`, even with a host navigation handler wired. These pins hold the
 * chart to the same contract:
 *
 *  - `'navigate'` + host handler → the host's list page, no drawer at all;
 *  - `'navigate'` without a host handler → the documented fallback to a drawer;
 *  - `'dialog'` / default `'drawer'` → unchanged.
 *
 * The chart renderer is mocked down to a click surface on purpose. What is
 * under test is ObjectChart's drill routing, not recharts' hit-testing — a real
 * segment click in jsdom would test the SVG geometry instead of the branch.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { DrillNavigationProvider } from '@object-ui/react';

vi.mock('./ChartRenderer', () => ({
  ChartRenderer: ({ onChartClick }: any) => (
    <button
      type="button"
      data-testid="fake-segment"
      onClick={() => onChartClick?.({ category: 'won', series: 'amount', value: 42 })}
    >
      segment
    </button>
  ),
}));

import { ObjectChart } from './ObjectChart';

afterEach(cleanup);

const schema = (drillDown: Record<string, unknown>) => ({
  type: 'object-chart',
  chartType: 'bar',
  objectName: 'opportunity',
  xAxisKey: 'stage',
  data: [{ stage: 'won', amount: 42 }],
  filter: { owner: 'me' },
  drillDown,
});

function renderChart(
  drillDown: Record<string, unknown>,
  openRecordList?: (objectName: string, filter?: Record<string, unknown>) => void,
) {
  return render(
    <DrillNavigationProvider value={{ openRecordList }}>
      <ObjectChart schema={schema(drillDown)} dataSource={{ find: async () => ({ data: [] }) }} />
    </DrillNavigationProvider>,
  );
}

/**
 * Which overlay the drill body landed in. Radix gives Sheet and Dialog the same
 * `role="dialog"`, so the two are told apart by the primitive's own positioning
 * classes: the side sheet is pinned to an edge (`inset-y-0`), the modal is
 * centre-translated (`translate-x-[-50%]`). Both come from
 * `packages/components/src/ui/*` — upstream shadcn files, not ours to churn.
 */
function drillSurface(): 'drawer' | 'dialog' {
  const body = screen.getByTestId('chart-drill-body');
  const surface = body.closest('[role="dialog"]');
  const cls = surface?.className ?? '';
  if (cls.includes('inset-y-0')) return 'drawer';
  if (cls.includes('translate-x-[-50%]')) return 'dialog';
  throw new Error(`drill body is in neither a sheet nor a dialog: "${cls}"`);
}

describe("ObjectChart — DrillDownConfig.target: 'navigate' (objectui#3354)", () => {
  it("navigates to the object's list page with the drill filter and renders no drawer", async () => {
    const openRecordList = vi.fn();
    renderChart({ enabled: true, target: 'navigate' }, openRecordList);

    fireEvent.click(screen.getByTestId('fake-segment'));

    // Widget filter ∧ click context — the same merge the drawer would have used.
    await waitFor(() =>
      expect(openRecordList).toHaveBeenCalledWith('opportunity', { owner: 'me', stage: 'won' }),
    );
    expect(screen.queryByTestId('chart-drill-body')).toBeNull();
    // …and it does not fire again on subsequent renders.
    expect(openRecordList).toHaveBeenCalledTimes(1);
  });

  it("falls back to the drawer when the host provides no navigation (the JSDoc's promise)", async () => {
    renderChart({ enabled: true, target: 'navigate' }, undefined);

    fireEvent.click(screen.getByTestId('fake-segment'));

    await waitFor(() => expect(screen.getByTestId('chart-drill-body')).toBeTruthy());
    expect(drillSurface()).toBe('drawer');
  });

  it('still opens the in-place drawer for the default target, even with navigation wired', async () => {
    const openRecordList = vi.fn();
    renderChart({ enabled: true }, openRecordList);

    fireEvent.click(screen.getByTestId('fake-segment'));

    await waitFor(() => expect(screen.getByTestId('chart-drill-body')).toBeTruthy());
    expect(drillSurface()).toBe('drawer');
    expect(openRecordList).not.toHaveBeenCalled();
    // The header escape hatch is independent of `target` — it stays available.
    expect(screen.getByTestId('drill-open-in-list')).toBeTruthy();
  });

  it("still opens the dialog for target: 'dialog', even with navigation wired", async () => {
    const openRecordList = vi.fn();
    renderChart({ enabled: true, target: 'dialog' }, openRecordList);

    fireEvent.click(screen.getByTestId('fake-segment'));

    await waitFor(() => expect(screen.getByTestId('chart-drill-body')).toBeTruthy());
    expect(drillSurface()).toBe('dialog');
    expect(openRecordList).not.toHaveBeenCalled();
  });
});
