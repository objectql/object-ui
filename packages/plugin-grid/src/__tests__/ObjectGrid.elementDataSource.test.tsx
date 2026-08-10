/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-grid` consumes `PageComponentSchema.dataSource` (objectstack#6953).
 *
 * The spec declares this binding on EVERY page component, and objectstack#5576
 * wired it to `list-view` only. On `object-grid` nothing mapped
 * `dataSource.object` onto the `objectName` this block requires, so a page that
 * declared the binding the spec documents — and no separate `objectName` —
 * rendered an EMPTY grid: `getDataConfig` returned `null`, the fetch effect
 * never ran, and no error was reported anywhere. "Spec-valid metadata renders
 * nothing" is the objectstack#4413 shape.
 *
 * `object-grid` is the one block the binding maps onto without a gap — it reads
 * every key the binding carries — so both directions are asserted end to end
 * here: what reaches `dataSource.find`, and that a grid with no binding is
 * untouched.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-grid` (and the ElementDataSourceGate wiring under test).
import '../index';

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
    find: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Acme', rating: 'hot' }], total: 1 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      fields: { id: { type: 'text' }, name: { type: 'text' }, rating: { type: 'text' } },
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

describe('object-grid — dataSource: { object, view } (objectstack#6953)', () => {
  it('queries the bound object with the saved view’s filter, sort and row cap', async () => {
    const adapter = makeAdapter();
    renderBlock({ type: 'object-grid', dataSource: { object: 'account', view: 'hot' } }, adapter);

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());

    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    // `object` → `objectName`: the mapping that did not exist. Without it there
    // was no query at all, not a wrong one.
    expect(object).toBe('account');
    expect(params.$filter).toEqual([['rating', '=', 'hot']]);
    // `ObjectGrid` lowers a declared sort to the string form on the wire.
    expect(params.$orderby).toBe('name desc');
    // The view's page size is the fetch window, not just a display setting.
    expect(params.$top).toBe(7);
  });

  it('AND-combines the binding’s own filter with the view’s', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-grid',
        dataSource: { object: 'account', view: 'hot', filter: [['amount', '>', 100]] },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const json = JSON.stringify((adapter.find.mock.calls[0] as any[])[1].$filter);
    // "Additional filter criteria" (spec): the binding may only narrow the view.
    expect(json).toContain('rating');
    expect(json).toContain('amount');
  });

  it('reports an unresolvable `view` instead of querying the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      { type: 'object-grid', dataSource: { object: 'account', view: 'nope' } },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-grid-datasource-error"]')).not.toBeNull(),
    );
    // The point of failing loudly: a typo must not become a wider answer.
    expect(adapter.find).not.toHaveBeenCalled();
    expect(container.textContent).toContain('hot');
  });

  it('leaves a grid with NO dataSource exactly as it was', async () => {
    // The other direction of the single-variable reproduction. Nothing about the
    // flat-key path may move: same object, same filter, same window.
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-grid',
        objectName: 'account',
        columns: [{ field: 'name' }],
        filter: [['owner', '=', 'me']],
        pagination: { pageSize: 25 },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('account');
    expect(params.$filter).toEqual([['owner', '=', 'me']]);
    expect(params.$top).toBe(25);
    // No view was named, so nothing may be fetched about views either.
    expect(adapter.getObjectSchema).toHaveBeenCalledWith('account');
  });
});
