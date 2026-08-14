/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4614 — the same guarantee, one level out: through the SDUI registry.
 *
 * `DashboardGridLayout.datasetPath.test.tsx` renders the component directly.
 * This file renders it the way a schema-driven host does — as the registered
 * `dashboard-grid` component type, resolved by `SchemaRenderer` from the schema
 * (`index.tsx:271-289`) — because that registration is the surface the card was
 * filed against, and the new `dataSource` prop is only useful if it survives the
 * trip through the renderer loop.
 *
 * Two directions, both load-bearing and neither visible from the component-level
 * suite:
 *
 * 1. **No `dataSource` passed.** `dashboard-grid` declares only `title` and
 *    `className` inputs, so this is what schema-driven hosts actually render.
 *    Adding an optional prop must not break them, and a dataset-bound widget
 *    arriving this way must still say something visible rather than draw a blank
 *    tile.
 * 2. **`dataSource` passed to `SchemaRenderer`.** It reaches `DatasetWidget`
 *    only because `SchemaRenderer` forwards every prop it does not itself read
 *    to the resolved component (`...props`, spread last — `SchemaRenderer.tsx:632`).
 *    That is also why the spec's per-element `dataSource` BINDING is stripped
 *    from the schema before that spread (`SchemaRenderer.tsx:564-575`,
 *    objectstack#5576): the binding and the adapter share a name, and the
 *    adapter is the one that must win. Nothing else in this repo pins that
 *    interaction for this component.
 *
 * The registries are imported at module scope, never in a hook (AGENTS.md
 * 测试纪律, objectui#3010). `../index` is what registers `dashboard-grid` itself.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import '@object-ui/plugin-charts';
import '../index';

afterEach(cleanup);

/**
 * `dataset` / `values` are ADR-0021 authoring keys the bundled
 * `DashboardComponentSchema` does not carry yet, and `dashboard-grid` is
 * resolved by type name at runtime — so the node is built as the stored
 * metadata it represents.
 */
const gridSchema = (widget: Record<string, unknown>) =>
  ({ type: 'dashboard-grid', widgets: [widget] }) as unknown as Parameters<typeof SchemaRenderer>[0]['schema'];

describe('dashboard-grid via the SDUI registry (#4614)', () => {
  it('renders the visible dataset diagnostic when the host passes no dataSource', async () => {
    // The registration's own shape: no adapter input is declared, so this is
    // the default schema-driven path — and it must not be a blank tile.
    render(<SchemaRenderer schema={gridSchema({ id: 'w1', type: 'bar', dataset: 'invoices', dimensions: ['status'], values: ['count'] })} />);
    const message = await screen.findByText('This data source does not support dataset queries.');
    expect(message).toBeInTheDocument();
    expect(message.closest('[role="alert"]')).not.toBeNull();
    // The grid itself still rendered — the diagnostic is inside it, not instead
    // of it, so schema-driven usage is intact rather than merely failing loudly.
    expect(screen.getByTestId('grid-layout')).toBeInTheDocument();
  });

  it('forwards a dataSource given to SchemaRenderer all the way to the dataset query', async () => {
    const src = {
      queryDataset: vi.fn(async () => ({
        rows: [{ invoice_count: 42 }],
        fields: [{ name: 'invoice_count', type: 'number', label: 'Invoices' }],
      })),
    };
    render(
      <SchemaRenderer
        schema={gridSchema({ id: 'w1', type: 'metric', dataset: 'invoices', values: ['invoice_count'] })}
        dataSource={src}
      />,
    );
    await waitFor(() =>
      expect(src.queryDataset).toHaveBeenCalledWith('invoices', { dimensions: [], measures: ['invoice_count'] }),
    );
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  it('leaves a static-data widget on its existing path when rendered through the registry', async () => {
    // The registration must keep behaving exactly as it did for every widget
    // shape that already worked.
    const src = { queryDataset: vi.fn(async () => ({ rows: [] })) };
    render(
      <SchemaRenderer
        schema={gridSchema({ id: 'w1', type: 'bar', options: { data: [{ name: 'A', value: 1 }] } })}
        dataSource={src}
      />,
    );
    expect(await screen.findByTestId('grid-layout')).toBeInTheDocument();
    expect(src.queryDataset).not.toHaveBeenCalled();
    expect(screen.queryByText(/does not support dataset queries/)).not.toBeInTheDocument();
  });
});
