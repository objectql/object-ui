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
 * looks like a rendered board. The mapping therefore takes only `object` and
 * `filter`, and the third test pins that the authored lanes survive.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
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

  it('leaves a board with NO dataSource exactly as it was', async () => {
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
