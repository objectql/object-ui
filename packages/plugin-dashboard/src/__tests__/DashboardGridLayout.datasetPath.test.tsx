/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4614 — the editable grid gains the ADR-0021 dataset path it never had.
 *
 * `DashboardRenderer` has routed a dataset-bound widget through `DatasetWidget`
 * — the governed `queryDataset` path — since ADR-0021. `DashboardGridLayout`,
 * separately exported and registered as the `dashboard-grid` SDUI component,
 * never read `widget.dataset` at all and took no `dataSource` prop, so a widget
 * authored in the CURRENT shape fell through to the static-data branch. Measured
 * on `origin/main` (8640cec19) by spying on the node handed to `SchemaRenderer`,
 * the silence had three flavours, not the one the issue reported:
 *
 *   bar    → { type: 'chart',      chartType: 'bar', data: [], … }  → blank chart
 *   metric → { type: 'metric',     label: 'metric', value: '—' }    → em dash
 *   table  → { type: 'data-table', data: [], … }                    → empty table
 *
 * No data, no diagnostic, no path to fix — objectui#4612's defect one level up.
 * #4612 was the RETIRED authoring shape falling through this same surface; this
 * is the CURRENT one.
 *
 * ## Why the component registries are imported here
 *
 * At module scope, never in a hook (the cold transform must not be billed to a
 * bounded test budget — AGENTS.md 测试纪律, objectui#3010), and for a reason this
 * suite cannot do without: with `chart` unregistered, `SchemaRenderer` renders a
 * red "Unknown component type" box carrying `role="alert"`, and an assertion for
 * the dataset diagnostic's alert would have passed on that box — pre-fix, with
 * no dataset path in the file at all. `chart` lives in `@object-ui/plugin-charts`
 * (a declared devDependency), not in `@object-ui/components`, so BOTH are needed
 * to reproduce what a real host renders. With them, the pre-fix tile for a
 * dataset-bound widget is exactly what the issue says: empty — no alert, no
 * chart, nothing.
 *
 * ## Why no new placeholder for the no-dataSource half
 *
 * The ruling asked for a VISIBLE state — never a blank — when a dataset-bound
 * widget arrives with no data source, and asked to measure `DatasetWidget`'s own
 * no-capability rendering before inventing a second one. Measured: with
 * `dataSource={undefined}` it renders `role="alert"` carrying "This data source
 * does not support dataset queries." (`DatasetWidget.tsx:766-771` sets the error
 * state BEFORE the measures check; `:929-934` renders it). It is visible in this
 * context, so routing through `DatasetWidget` UNCONDITIONALLY is the whole fix
 * and no third diagnostic surface is declared. `dashboard-grid`'s SDUI
 * registration passes no `dataSource`, so that path IS this case — pinned below.
 *
 * The negative controls are the binding half: static-data, `options.data`
 * provider, and the #4613 legacy-retired widget must all keep rendering exactly
 * as before AND must never reach the dataset query.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { DashboardComponentSchema } from '@object-ui/types';
import '@object-ui/components';
import '@object-ui/plugin-charts';
import { DashboardGridLayout } from '../DashboardGridLayout';

afterEach(cleanup);

/**
 * `dataset` / `values` / `dimensions` are the ADR-0021 authoring keys; `object`
 * + `categoryField` (the legacy control) were removed from the widget vocabulary
 * by framework#3320. The cast mirrors `DashboardGridLayout.legacyRetired.test.tsx`
 * — stored metadata is what a renderer actually receives.
 */
const dash = (widget: Record<string, unknown>): DashboardComponentSchema =>
  ({ type: 'dashboard', widgets: [widget] }) as unknown as DashboardComponentSchema;

/** The same stub shape `DatasetWidget`'s own suite uses for a capable source. */
const makeSource = (impl: () => Promise<Record<string, unknown>>) => ({ queryDataset: vi.fn(impl) });

/**
 * Negative-control discipline, carried over from the #4613 suite: every control
 * asserts BOTH the absence of the dataset path AND that the widget really
 * rendered — otherwise "no dataset query" would also be satisfied by a grid that
 * threw or drew nothing, and the control would pass for the wrong reason.
 */
const renderOne = (widget: Record<string, unknown>, dataSource?: unknown) => {
  const { container } = render(<DashboardGridLayout schema={dash(widget)} dataSource={dataSource} />);
  expect(container.querySelector('[data-testid="grid-layout"]')).toBeInTheDocument();
  return container;
};

describe('DashboardGridLayout dataset-bound widgets (#4614)', () => {
  // ── positives: the path that did not exist ──────────────────────────────
  it('renders the KPI value a dataset-bound metric widget queried for', async () => {
    const src = makeSource(async () => ({
      rows: [{ invoice_count: 42 }],
      fields: [{ name: 'invoice_count', type: 'number', label: 'Invoices' }],
    }));
    render(
      <DashboardGridLayout
        schema={dash({ id: 'w1', type: 'metric', dataset: 'invoices', values: ['invoice_count'] })}
        dataSource={src}
      />,
    );
    // The real DatasetWidget outcome from the canned rows. Before this change
    // the widget rendered the static-data branch's em dash — `value: '—'`.
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(src.queryDataset).toHaveBeenCalledWith('invoices', { dimensions: [], measures: ['invoice_count'] });
  });

  it('renders real table content (resolved header labels + a cell) for a dataset-bound table widget', async () => {
    const src = makeSource(async () => ({
      rows: [{ status: 'Open', invoice_count: 5 }],
      fields: [
        { name: 'status', type: 'string', label: 'Status' },
        { name: 'invoice_count', type: 'number', label: 'Invoices' },
      ],
    }));
    render(
      <DashboardGridLayout
        schema={dash({ id: 'w1', type: 'table', dataset: 'invoices', dimensions: ['status'], values: ['invoice_count'] })}
        dataSource={src}
      />,
    );
    // Header labels come from the dataset result's fields — the `data: []`
    // data-table it used to build has no headers and no cells at all.
    expect(await screen.findByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('runs the governed dataset query for a dataset-bound chart widget — dimensions→dimensions, values→measures', async () => {
    const src = makeSource(async () => ({
      rows: [{ status: 'Open', invoice_count: 5 }, { status: 'Paid', invoice_count: 9 }],
      fields: [
        { name: 'status', type: 'string', label: 'Status' },
        { name: 'invoice_count', type: 'number', label: 'Invoices' },
      ],
    }));
    render(
      <DashboardGridLayout
        schema={dash({ id: 'w1', type: 'bar', dataset: 'invoices', dimensions: ['status'], values: ['invoice_count'] })}
        dataSource={src}
      />,
    );
    // The query IS the observable outcome for a chart under jsdom (recharts
    // draws nothing at zero width), and it is precisely what the grid skipped:
    // `data: []` never called anything.
    await waitFor(() =>
      expect(src.queryDataset).toHaveBeenCalledWith('invoices', { dimensions: ['status'], measures: ['invoice_count'] }),
    );
  });

  it('mounts DatasetWidget itself — a pending query shows ITS loading skeleton, which no other branch of this grid can produce', () => {
    // The `pendingSource` idiom from DatasetWidget's own suite. `dataset-loading`
    // is DatasetWidget's testid and nothing else on this surface emits it, so
    // this pins WHICH component renders the tile, independently of what the
    // query eventually resolves to.
    const src = { queryDataset: vi.fn(() => new Promise<Record<string, unknown>>(() => {})) };
    render(
      <DashboardGridLayout
        schema={dash({ id: 'w1', type: 'bar', dataset: 'invoices', dimensions: ['status'], values: ['invoice_count'] })}
        dataSource={src}
      />,
    );
    expect(screen.getByTestId('dataset-loading')).toBeInTheDocument();
  });

  it('says so VISIBLY when a dataset-bound widget arrives with NO dataSource — never a blank (the SDUI registration path)', async () => {
    // `dashboard-grid` is registered with inputs `title` / `className` only and
    // is rendered by hosts that pass no adapter, so this is the shape the SDUI
    // component type actually renders in. It must state the problem rather than
    // draw nothing — measured pre-fix, the tile held no alert, no chart and no
    // text at all.
    render(<DashboardGridLayout schema={dash({ id: 'w1', type: 'bar', dataset: 'invoices', dimensions: ['status'], values: ['count'] })} />);
    // Wording pinned verbatim — the message IS the diagnostic, and it is
    // DatasetWidget's own (one condition, one wording, no third surface).
    const message = await screen.findByText('This data source does not support dataset queries.');
    expect(message).toBeInTheDocument();
    // Rendered AS an alert — asserted on the element carrying the message, not
    // by a bare role query, which `SchemaRenderer`'s own "Unknown component
    // type" box would also satisfy.
    expect(message.closest('[role="alert"]')).not.toBeNull();
  });

  it.each([
    ['metric', { id: 'w1', type: 'metric', dataset: 'invoices', values: ['count'] }],
    ['table', { id: 'w1', type: 'table', dataset: 'invoices', dimensions: ['status'], values: ['count'] }],
    ['pivot', { id: 'w1', type: 'pivot', dataset: 'invoices', dimensions: ['status'], values: ['count'] }],
  ])('cures the %s flavour of the same silence — no dataSource still says something', async (_kind, widget) => {
    // The pre-fix measurement found three different empty artifacts, one per
    // family (blank chart / em-dash metric / empty table). All three are the
    // same defect and all three take the same cure, so all three are pinned —
    // the em dash in particular reads as a rendered value, not as an error.
    render(<DashboardGridLayout schema={dash(widget)} />);
    expect(await screen.findByText('This data source does not support dataset queries.')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  // ── negatives: everything that must render exactly as it did ────────────
  it('does NOT take the dataset path for a static-data widget', () => {
    const src = makeSource(async () => ({ rows: [] }));
    renderOne({ id: 'w1', type: 'bar', options: { data: [{ name: 'A', value: 1 }] } }, src);
    expect(src.queryDataset).not.toHaveBeenCalled();
    expect(screen.queryByText(/does not support dataset queries/)).not.toBeInTheDocument();
  });

  it('does NOT take the dataset path for an options.data provider widget', () => {
    // The nested `{ provider: 'object', … }` config is a separate, LIVE surface
    // that carries its own `object`/`aggregate` and renders through
    // `object-chart`. Conflating it with a dataset binding would retire it.
    const src = makeSource(async () => ({ rows: [] }));
    renderOne(
      {
        id: 'w1',
        type: 'bar',
        options: { data: { provider: 'object', object: 'invoices', aggregate: { field: 'amount', function: 'sum' } } },
      },
      src,
    );
    expect(src.queryDataset).not.toHaveBeenCalled();
    expect(screen.queryByText(/does not support dataset queries/)).not.toBeInTheDocument();
  });

  it('does NOT take the dataset path for a static-data pivot widget', () => {
    const src = makeSource(async () => ({ rows: [] }));
    renderOne({ id: 'w1', type: 'pivot', options: { data: [{ region: 'EMEA', amount: 1 }] } }, src);
    expect(src.queryDataset).not.toHaveBeenCalled();
  });

  it('still shows the #4613 retired-format placeholder for a legacy widget, and runs no dataset query', () => {
    // The shared sentinel keeps its verdict: `isLegacyRetiredWidget` returns
    // false the moment a widget carries `dataset`, so the two conditions are
    // mutually exclusive and neither can capture the other's widget.
    const src = makeSource(async () => ({ rows: [] }));
    renderOne({ id: 'w1', type: 'bar', object: 'invoices', categoryField: 'month', valueField: 'amount', aggregate: 'sum' }, src);
    expect(
      screen.getByText('This widget uses a retired data format. Edit it to bind a dataset.'),
    ).toBeInTheDocument();
    expect(src.queryDataset).not.toHaveBeenCalled();
  });

  it('renders a legacy widget’s placeholder even when a dataSource IS supplied — the sentinel is not a data question', () => {
    const src = makeSource(async () => ({ rows: [{ x: 1 }] }));
    renderOne({ id: 'w1', type: 'metric', object: 'invoices', aggregate: 'count' }, src);
    expect(screen.getByText(/retired data format/i)).toBeInTheDocument();
    expect(src.queryDataset).not.toHaveBeenCalled();
  });
});
