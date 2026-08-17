/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-kanban` consumes `PageComponentSchema.dataSource` (objectstack#6953).
 *
 * The board gates its fetch on `schema.objectName` and nothing mapped the spec's
 * `dataSource.object` onto it, so a board authored with the binding the spec
 * documents rendered its declared lanes with no cards, no request and no error.
 *
 * ## Why `columns` is NOT taken from the view
 *
 * A board's `columns` are its SWIMLANES (`{ id, title }` per `groupBy` value),
 * not a field projection. A saved view's `columns: ['name','rating']` written
 * there would render two empty lanes named after fields — a wrong answer that
 * looks like a rendered board. The mapping therefore takes `object`, `filter`
 * and `limit`, and the third test pins that the authored lanes survive.
 *
 * ## The row cap (objectui#4025)
 *
 * The board's cap was written `{ options: { $top: 100 } }`: `$filter` at the top
 * level where the adapters read it, the cap one level down under `options`, which
 * is not a `QueryParams` key and which no adapter in this repo reads. So the
 * board had no row cap at all, and `limit` stayed unmapped on the strength of a
 * "fixed window" that did not exist. The last describe block below pins the cap
 * as a real top-level `$top` and pins every source that can set it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { DEFAULT_KANBAN_LIMIT } from './ObjectKanban';
// Registers `object-kanban` (and the ElementDataSourceGate wiring under test).
import './index';
// The lane titles asserted below render INSIDE `KanbanRenderer`'s `React.lazy`
// boundary. Importing the chunk at module scope bills the cold transform to the
// import phase (unbounded) instead of racing a `waitFor` budget under full
// parallelism — the objectui#3010 rule, same specifier as `index.tsx`'s factory
// so ESM's module cache makes that factory resolve immediately.
import './KanbanImpl';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot accounts',
  columns: ['name', 'rating'],
  filter: [['rating', '=', 'hot']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

const LANES = [
  { id: 'open', title: 'Open' },
  { id: 'won', title: 'Won' },
];

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Acme', status: 'open' }] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      fields: { name: { type: 'text' }, status: { type: 'text' }, rating: { type: 'text' } },
      listViews,
    }),
  };
}

const renderBlock = (schema: Record<string, unknown>, adapter: ReturnType<typeof makeAdapter>) =>
  render(
    <SchemaRendererProvider dataSource={adapter as any}>
      <SchemaRenderer schema={schema as any} />
    </SchemaRendererProvider>,
  );

describe('object-kanban — dataSource: { object, view } (objectstack#6953)', () => {
  it('queries the bound object with the saved view’s filter', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-kanban',
        groupBy: 'status',
        columns: LANES,
        dataSource: { object: 'account', view: 'hot' },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('account');
    expect(params.$filter).toEqual([['rating', '=', 'hot']]);
  });

  it('keeps the authored SWIMLANES — the view’s field list is not a lane list', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-kanban',
        groupBy: 'status',
        columns: LANES,
        dataSource: { object: 'account', view: 'hot' },
      },
      adapter,
    );

    // Lane titles, not field names: `rating` must never become a lane on a
    // board. `waitFor` because the lanes render past a Suspense boundary.
    await waitFor(() => expect(container.textContent).toContain('Open'));
    expect(container.textContent).toContain('Won');
    expect(container.textContent).not.toContain('rating');
  });

  it('reports an unresolvable `view` instead of fetching the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-kanban',
        groupBy: 'status',
        columns: LANES,
        dataSource: { object: 'account', view: 'nope' },
      },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-kanban-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.find).not.toHaveBeenCalled();
  });

  it('leaves a board with NO dataSource querying its own object and filter', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-kanban',
        objectName: 'account',
        groupBy: 'status',
        columns: LANES,
        filter: [['owner', '=', 'me']],
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('account');
    expect(params.$filter).toEqual([['owner', '=', 'me']]);
  });
});

/**
 * The row cap (objectui#4025).
 *
 * Every assertion here also pins the ABSENCE of `params.options`: the defect was
 * not a wrong number, it was a right number written where nothing reads it, and
 * a test that only checked `$top` would stay green if someone re-added the dead
 * nesting beside it.
 */
describe('object-kanban — the row cap reaches the wire (objectui#4025)', () => {
  const firstQuery = async (adapter: ReturnType<typeof makeAdapter>) => {
    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    return adapter.find.mock.calls[0] as [string, any];
  };

  it('caps an uncapped board at the default window, as a REAL $top', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-kanban', objectName: 'account', groupBy: 'status', columns: LANES },
      adapter,
    );

    const [object, params] = await firstQuery(adapter);
    expect(object).toBe('account');
    // The number is the one the board always intended; it just reaches the
    // adapter now (`convertQueryParams` in `@object-ui/data-objectstack` and
    // `ApiDataSource` both read `params.$top`, neither reads `params.options`).
    expect(params.$top).toBe(DEFAULT_KANBAN_LIMIT);
    expect(params.$top).toBe(100);
    expect(params.options).toBeUndefined();
  });

  it('honours a `limit` authored directly on the block', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-kanban', objectName: 'account', groupBy: 'status', columns: LANES, limit: 20 },
      adapter,
    );

    const [, params] = await firstQuery(adapter);
    expect(params.$top).toBe(20);
    expect(params.options).toBeUndefined();
  });

  it('takes a named view’s page size as the board’s window', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-kanban',
        groupBy: 'status',
        columns: LANES,
        dataSource: { object: 'account', view: 'hot' },
      },
      adapter,
    );

    const [object, params] = await firstQuery(adapter);
    expect(object).toBe('account');
    // `hot` declares `pagination: { pageSize: 7 }` — a view's row cap.
    expect(params.$top).toBe(7);
    // The view's filter still arrives: the cap did not displace it.
    expect(params.$filter).toEqual([['rating', '=', 'hot']]);
    expect(params.options).toBeUndefined();
  });

  it('lets the binding’s own `limit` override the view’s page size', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-kanban',
        groupBy: 'status',
        columns: LANES,
        dataSource: { object: 'account', view: 'hot', limit: 3 },
      },
      adapter,
    );

    const [, params] = await firstQuery(adapter);
    // `limit` overrides rather than combines — the binding is the narrower,
    // more local statement (see `composeElementDataSource`).
    expect(params.$top).toBe(3);
    expect(params.options).toBeUndefined();
  });
});
