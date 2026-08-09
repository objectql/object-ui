/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:line_items` consumes `PageComponentSchema.dataSource` (objectstack#7121).
 *
 * This is the one block in the batch whose object does NOT live under
 * `objectName`: the collection it lists, fetches and writes is
 * `schema.childObject`, so the binding's `object` maps THERE — the same way it
 * maps onto `record:related_list`'s `objectName`, which likewise names the CHILD
 * object the panel is bound to. Authored with the binding and no `childObject`,
 * the panel used to query the object `undefined`.
 *
 * Nothing else is mapped, and the last two cases pin that rather than trusting a
 * comment: `relationshipField` stays the author's (it must name a field on the
 * bound child object), the query is `{ [relationshipField]: parentId }` and a
 * fixed `$top: 500` — so `filter` / `sort` / `limit` have no read site — and
 * `columns` here is `GridColumn[]` driving an EDITABLE grid, not a field-name
 * projection a saved view could fill.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `record:line_items` (and the ElementDataSourceGate wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Billable lines',
  // Deliberately DIFFERENT from the authored grid columns below, so the
  // "columns are not mapped" pin has something to observe.
  columns: ['qty', 'price'],
  filter: [['billable', '=', true]],
  sort: [{ field: 'qty', order: 'desc' }],
  pagination: { pageSize: 7 },
};

const COLUMNS = [{ field: 'qty', label: 'Qty', type: 'number' as const }];

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'invoice_line',
      fields: {
        qty: { name: 'qty', type: 'number', label: 'Qty' },
        price: { name: 'price', type: 'currency', label: 'Price' },
        billable: { name: 'billable', type: 'boolean', label: 'Billable' },
      },
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

const headerTexts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent ?? '');

describe('record:line_items — dataSource: { object } (objectstack#7121)', () => {
  it('lists the CHILD object named by the binding, scoped to the parent record', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'record:line_items',
        relationshipField: 'invoice',
        parentId: 'inv-1',
        columns: COLUMNS,
        dataSource: { object: 'invoice_line' },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('invoice_line');
    // The parent relationship is still what scopes the list — the binding named
    // the object, not the scope.
    expect(params.$filter).toEqual({ invoice: 'inv-1' });
    expect(params.$top).toBe(500);
  });

  it('reports an unresolvable `view` instead of listing the whole child object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'record:line_items',
        relationshipField: 'invoice',
        parentId: 'inv-1',
        columns: COLUMNS,
        dataSource: { object: 'invoice_line', view: 'nope' },
      },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="record-line-items-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.find).not.toHaveBeenCalled();
  });

  it('a resolvable view contributes nothing: no filter, no ordering, no cap, no columns', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'record:line_items',
        relationshipField: 'invoice',
        parentId: 'inv-1',
        columns: COLUMNS,
        dataSource: {
          object: 'invoice_line',
          view: 'hot',
          sort: [{ field: 'price', order: 'asc' }],
          limit: 3,
        },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('invoice_line');
    // The query is the FK scope and the fixed window, exactly as before: none of
    // the view's filter/sort nor the binding's sort/limit has a read site here.
    expect(params.$filter).toEqual({ invoice: 'inv-1' });
    expect(params.$top).toBe(500);
    expect(params.$orderby).toBeUndefined();

    // And the editable grid keeps the authored GridColumn list — a view's bare
    // field names would arrive with no `field`/`type` and render header-less,
    // type-less cells. Wrong SHAPE, not merely a wider answer.
    await waitFor(() => expect(headerTexts(container)).toContain('Qty'));
    expect(headerTexts(container).join('|')).not.toContain('price');
  });

  it('leaves a panel with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'record:line_items',
        childObject: 'invoice_line',
        relationshipField: 'invoice',
        parentId: 'inv-1',
        columns: COLUMNS,
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('invoice_line');
    expect(params.$filter).toEqual({ invoice: 'inv-1' });
    expect(params.$top).toBe(500);
  });
});
