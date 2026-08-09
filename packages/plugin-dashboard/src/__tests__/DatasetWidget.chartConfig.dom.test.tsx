// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectstack#7016 — END TO END: dashboard metadata → real chart DOM.
 *
 * The sibling `DatasetWidget.chartConfig.test.tsx` pins the decision at the
 * schema seam. That is necessary and not sufficient: the criterion for lowering
 * a `chartConfig` key is that the chart block *draws* it, and a seam assertion
 * cannot tell a honoured prop from an ignored one. So this file renders the REAL
 * chain — `DatasetWidget` → `SchemaRenderer` → the registry's `chart`
 * (`ChartRenderer`) → `AdvancedChartImpl` — with no renderer stub at all, and
 * reads the resulting DOM.
 *
 * Scope of what can be proven here: everything the chart draws OUTSIDE Recharts'
 * `ResponsiveContainer` — the ChartFrame titles, and the chart container's
 * height and accessible name. Recharts' own marks (bars, LabelList, reference
 * lines, Brush) need a measured box, which the headless DOM never provides
 * (`ResponsiveContainer` measures 0×0 and renders no children), so asserting
 * their absence *here* would pass for the wrong reason. Those keys are pinned in
 * `packages/plugin-charts/src/ChartRenderer.dashboardChartConfig.test.tsx`,
 * which mocks `ResponsiveContainer` to a fixed size — the only place in this
 * repo that can, since `recharts` resolves inside plugin-charts alone.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';

// Registers `chart` in the ComponentRegistry, which is what `SchemaRenderer`
// resolves the widget's `{ type: 'chart' }` schema through.
import '@object-ui/plugin-charts';
// `ChartRenderer` renders its implementation behind
// `React.lazy(() => import('./AdvancedChartImpl'))`, and every assertion below
// lives inside that Suspense boundary. Loading it is unbounded work — under full
// parallelism a first import of the recharts graph can outlast RTL's 1000ms
// `waitFor` window — so pay it in the import phase, which no test or hook
// timeout applies to (AGENTS.md §测试纪律). The alias maps this specifier to the
// very file the lazy factory imports, so the ESM cache already holds it.
import '@object-ui/plugin-charts/AdvancedChartImpl';
import { DatasetWidget } from '../DatasetWidget';

afterEach(cleanup);

const rows = [
  { status: 'open', total: 120 },
  { status: 'paid', total: 80 },
];

const renderWidget = async (chartConfig?: Record<string, unknown>) => {
  const src = { queryDataset: vi.fn(async () => ({ rows })) };
  const view = render(
    <DatasetWidget
      widget={{
        type: 'bar',
        dataset: 'invoices',
        dimensions: ['status'],
        values: ['total'],
        ...(chartConfig ? { chartConfig } : {}),
      }}
      dataSource={src}
    />,
  );
  // The chart container only exists once the dataset resolves AND the lazy chart
  // chunk has mounted — i.e. once the whole dashboard chart path really ran.
  await waitFor(() => expect(view.container.querySelector('[data-slot="chart"]')).not.toBeNull());
  return view;
};

const chartEl = (container: HTMLElement) => container.querySelector('[data-slot="chart"]') as HTMLElement;

describe('DatasetWidget — chartConfig reaches the real chart DOM (objectstack#7016)', () => {
  it('draws chartConfig.title / .subtitle above the plot', async () => {
    const { container } = await renderWidget({ type: 'bar', title: 'Invoice value', subtitle: 'by status' });
    expect(screen.getByText('Invoice value')).toBeTruthy();
    expect(screen.getByText('by status')).toBeTruthy();
    // The titles are drawn in a FRAME wrapping the plot, so the chart container
    // is no longer the widget root's direct child — the structural counterpart of
    // the "no chrome" case below.
    expect(chartEl(container).parentElement).not.toBe(container.firstElementChild);
  });

  it('adds no title chrome when chartConfig declares none', async () => {
    const { container } = await renderWidget({ type: 'bar' });
    // ChartFrame is a passthrough with neither title nor subtitle, so the plot
    // sits directly under the widget root — no wrapper, no empty header row.
    expect(chartEl(container).parentElement).toBe(container.firstElementChild);
  });

  it('announces chartConfig.description as the chart graphic accessible name', async () => {
    const { container } = await renderWidget({ type: 'bar', description: 'Invoice value by status' });
    expect(chartEl(container).getAttribute('role')).toBe('img');
    expect(chartEl(container).getAttribute('aria-label')).toBe('Invoice value by status');
  });

  it('leaves the graphic unlabelled when no description is declared', async () => {
    // Not the same as an empty one: role="img" with no name is worse for a
    // screen reader than a plain div it can skip past.
    const { container } = await renderWidget({ type: 'bar' });
    expect(chartEl(container).getAttribute('role')).toBeNull();
    expect(chartEl(container).getAttribute('aria-label')).toBeNull();
  });

  it('applies chartConfig.height over the container default', async () => {
    const { container } = await renderWidget({ type: 'bar', height: 420 });
    expect(chartEl(container).style.height).toBe('420px');
  });

  it('keeps the container default height when none is declared', async () => {
    const { container } = await renderWidget({ type: 'bar' });
    expect(chartEl(container).style.height).toBe('');
    expect(chartEl(container).className).toContain('h-[350px]');
  });

  // Negative pin for the one key refused on criterion 1 (nothing reads it). This
  // assertion is meaningful in this harness precisely because BOTH elements that
  // could have carried the name render outside `ResponsiveContainer`: the chart
  // container (which `description` does label, above) and the SchemaRenderer
  // wrapper (which would pick up a FLATTENED `ariaLabel`). Written, still
  // ignored — the current contract, pending objectstack#5175.
  it('ignores chartConfig.aria — no accessible name appears anywhere', async () => {
    const { container } = await renderWidget({
      type: 'bar',
      aria: { ariaLabel: 'Authored name', role: 'figure' },
    });
    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('[role="figure"]')).toBeNull();
    expect(chartEl(container).getAttribute('role')).toBeNull();
  });
});
