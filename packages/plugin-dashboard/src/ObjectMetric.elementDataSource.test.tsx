/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-metric` consumes `PageComponentSchema.dataSource` (objectstack#6953).
 *
 * This widget is registered directly and takes `objectName` / `filter` as PROPS
 * (`SchemaRenderer` spreads the schema's own keys onto it), so the spec's
 * per-element binding had no path in at all. Its no-object branch is the reason
 * the gap is worth a pin: with no `objectName` the widget does not error, it
 * renders its STATIC fallback value — a number that looks real and answers
 * nothing.
 *
 * `object` and `filter` are the only mapped keys: a metric is one aggregated
 * number, so there is no projection, no ordering and no page for the binding's
 * remaining keys to act on.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-metric` via `ObjectMetricBlock` (the wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot accounts',
  columns: ['name', 'rating'],
  filter: [['rating', '=', 'hot']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn().mockResolvedValue([{ amount: 42 }]),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      fields: { name: { type: 'text' }, rating: { type: 'text' }, amount: { type: 'number' } },
      listViews,
    }),
  };
}

const AGGREGATE = { field: 'amount', function: 'sum' };

const renderBlock = (schema: Record<string, unknown>, adapter: ReturnType<typeof makeAdapter>) =>
  render(
    <SchemaRendererProvider dataSource={adapter as any}>
      <SchemaRenderer schema={schema as any} />
    </SchemaRendererProvider>,
  );

describe('object-metric — dataSource: { object, view } (objectstack#6953)', () => {
  it('aggregates over the bound object with the saved view’s filter', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-metric',
        label: 'Pipeline',
        aggregate: AGGREGATE,
        dataSource: { object: 'account', view: 'hot' },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.aggregate).toHaveBeenCalled());
    const [object, params] = adapter.aggregate.mock.calls[0] as [string, any];
    expect(object).toBe('account');
    // `ObjectMetricWidget` passes the filter as the aggregate's own `filter`
    // key, not as an OData `$filter`.
    expect(params.filter).toEqual([['rating', '=', 'hot']]);
  });

  it('reports an unresolvable `view` instead of showing a number for the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-metric',
        label: 'Pipeline',
        aggregate: AGGREGATE,
        dataSource: { object: 'account', view: 'nope' },
      },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-metric-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.aggregate).not.toHaveBeenCalled();
  });

  it('leaves a metric with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-metric',
        objectName: 'account',
        label: 'Pipeline',
        aggregate: AGGREGATE,
        filter: [['owner', '=', 'me']],
      },
      adapter,
    );

    await waitFor(() => expect(adapter.aggregate).toHaveBeenCalled());
    const [object, params] = adapter.aggregate.mock.calls[0] as [string, any];
    expect(object).toBe('account');
    expect(params.filter).toEqual([['owner', '=', 'me']]);
  });
});
