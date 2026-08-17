/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-master-detail-form` consumes `PageComponentSchema.dataSource`
 * (objectstack#7121).
 *
 * `schema.objectName` is the PARENT object here, and everything downstream is
 * gated on it: the parent `ObjectForm` fetches its fields through it and
 * `deriveDetail` needs it to find each child's relationship field back to the
 * parent. Nothing mapped the spec's `dataSource.object` onto it, so a
 * master-detail form authored the way the spec documents rendered a parent shell
 * whose details could not resolve their own FK — no request, no error.
 *
 * `object` is the only mapped key: the parent is ONE record (no collection query
 * for `filter` / `sort` / `limit` to narrow) and the child collections are fetched
 * by FK from `schema.details` at a fixed `$top: 500`, not from anything the
 * binding carries.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-master-detail-form` (and the gate wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Open invoices',
  columns: ['number', 'status'],
  filter: [['status', '=', 'open']],
  sort: [{ field: 'number', order: 'desc' }],
  pagination: { pageSize: 7 },
};

/**
 * Fully configured details (FK + typed columns) so `needsDerive` is false and the
 * section header renders on the first pass — the marker below reads it to prove
 * the block itself mounted, not merely that the gate resolved.
 */
const DETAILS = [
  {
    childObject: 'invoice_line',
    relationshipField: 'invoice',
    title: 'Invoice lines',
    columns: [{ name: 'qty', type: 'number' as const }],
  },
];

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: vi.fn().mockResolvedValue({ id: 'i1' }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'invoice',
      label: 'Invoice',
      fields: {
        number: { name: 'number', type: 'text', label: 'Number' },
        status: { name: 'status', type: 'text', label: 'Status' },
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

describe('object-master-detail-form — dataSource: { object } (objectstack#7121)', () => {
  it('fetches the bound PARENT object’s schema, so the header form has fields', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-master-detail-form',
        mode: 'create',
        details: DETAILS,
        dataSource: { object: 'invoice' },
      },
      adapter,
    );

    // No `view` in this binding, so the gate itself never reads the object
    // definition — this call can only be the parent form's.
    await waitFor(() => expect(adapter.getObjectSchema).toHaveBeenCalledWith('invoice'));
  });

  it('honours `object` and nothing else the binding may carry', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-master-detail-form',
        mode: 'create',
        details: DETAILS,
        dataSource: {
          object: 'invoice',
          view: 'hot',
          filter: [['owner', '=', 'me']],
          sort: [{ field: 'number', order: 'asc' }],
          limit: 3,
        },
      },
      adapter,
    );

    // The block mounted (its own section header is on screen) …
    await waitFor(() => expect(container.textContent).toContain('Invoice lines'));
    // … and the resolvable view contributed nothing: a create-mode master-detail
    // form issues no parent collection query for a filter/sort/limit to reach.
    expect(adapter.find.mock.calls.filter(([object]) => object === 'invoice')).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="object-master-detail-form-datasource-error"]'),
    ).toBeNull();
  });

  it('reports an unresolvable `view` rather than rendering as if it resolved', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-master-detail-form',
        mode: 'create',
        details: DETAILS,
        dataSource: { object: 'invoice', view: 'nope' },
      },
      adapter,
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="object-master-detail-form-datasource-error"]'),
      ).not.toBeNull(),
    );
    // The block is not mounted behind the error — no half-resolved header form.
    expect(container.textContent).not.toContain('Invoice lines');
    expect(container.textContent).toContain('hot');
  });

  it('leaves a master-detail form with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-master-detail-form',
        objectName: 'invoice',
        mode: 'create',
        details: DETAILS,
      },
      adapter,
    );

    await waitFor(() => expect(adapter.getObjectSchema).toHaveBeenCalledWith('invoice'));
    expect(container.textContent).toContain('Invoice lines');
  });
});
