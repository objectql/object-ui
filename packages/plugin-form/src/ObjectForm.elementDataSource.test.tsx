/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-form` consumes `PageComponentSchema.dataSource` (objectstack#6953).
 *
 * `ObjectForm` gates its whole schema fetch on `objectName`, and nothing mapped
 * the spec's `dataSource.object` onto it — so a page authored with the binding
 * the spec documents rendered a field-less shell with no error. That is the
 * silent half of objectstack#6953.
 *
 * ## Scope, stated so the pin is not over-read
 *
 * `object` is the only key of the binding this block can honour, and the second
 * test says so as a property rather than a comment: a form edits ONE record, so
 * there is no collection query for `filter` / `sort` / `limit` to narrow, and a
 * saved LIST view's columns are not a form layout. Those keys are deliberately
 * left unmapped — writing them onto schema keys `ObjectForm` ignores would
 * reproduce the defect this wiring removes, one layer deeper.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-form` (and the ElementDataSourceGate wiring under test).
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
    find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: vi.fn().mockResolvedValue({ id: 'a1', name: 'Acme' }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      label: 'Account',
      fields: {
        name: { name: 'name', type: 'text', label: 'Name' },
        rating: { name: 'rating', type: 'text', label: 'Rating' },
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

describe('object-form — dataSource: { object } (objectstack#6953)', () => {
  it('fetches the bound object’s schema, so the form has fields at all', async () => {
    const adapter = makeAdapter();
    renderBlock({ type: 'object-form', mode: 'create', dataSource: { object: 'account' } }, adapter);

    // The observable difference: `getObjectSchema('account')` is what produces
    // the form's fields, and it was never called because `objectName` was unset.
    await waitFor(() => expect(adapter.getObjectSchema).toHaveBeenCalledWith('account'));
  });

  it('honours `object` and nothing else the binding may carry', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      {
        type: 'object-form',
        mode: 'create',
        dataSource: { object: 'account', view: 'hot', limit: 3, sort: [{ field: 'name', order: 'asc' }] },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.getObjectSchema).toHaveBeenCalledWith('account'));
    // A form issues no collection query, so a filter/sort/limit on the binding
    // has nothing to act on — and must not silently become one.
    expect(adapter.find).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="object-form-datasource-error"]')).toBeNull();
  });

  it('reports an unresolvable `view` rather than rendering as if it resolved', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      { type: 'object-form', mode: 'create', dataSource: { object: 'account', view: 'nope' } },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-form-datasource-error"]')).not.toBeNull(),
    );
    expect(container.textContent).toContain('hot');
  });

  it('leaves a form with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock({ type: 'object-form', objectName: 'account', mode: 'create' }, adapter);
    await waitFor(() => expect(adapter.getObjectSchema).toHaveBeenCalledWith('account'));
  });
});
