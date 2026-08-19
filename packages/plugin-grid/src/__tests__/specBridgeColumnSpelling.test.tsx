/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SpecBridge to ObjectGrid — a bridged view keeps its columns (objectui#5068).
 *
 * This is the half that could not have caught itself. `bridgeListView` takes a
 * spec-canonical `ListView` whose columns are ALREADY spelled `field`/`label`,
 * and used to down-translate every one of them to `accessorKey`/`header`
 * before emitting the `object-grid` node — which `ObjectGrid` then translated
 * back through the tolerance branch this card retires. Producer and consumer
 * were the two halves of one round trip, and deleting the consumer half alone
 * blanked every bridged grid in TOTAL SILENCE: measured on this card,
 * `headers ["#","Name"]` collapsed to `["#"]` with no error, while all 715
 * tests in this package stayed green — `specBridgeExportFormats.test.tsx`
 * renders bridge output through `ObjectGrid` and watched its grid lose every
 * column, because it asserts the export menu and never the columns.
 *
 * So the round trip is gone on BOTH sides in one PR (the shape objectui#3951
 * used: PR4909 migrated its consumer in `packages/fields` and its producer
 * `deriveMasterDetail` in `packages/plugin-form` together), and this file pins
 * the seam that had no pin. It lives in `plugin-grid` for the same reason the
 * export-formats test does: `@object-ui/plugin-grid` depends on
 * `@object-ui/react`, so it can see both `SpecBridge` and `ObjectGrid`; react
 * cannot import the grid without inverting the dependency graph.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider, SpecBridge } from '@object-ui/react';

registerAllFields();

const ROWS = [
  { id: '1', name: 'Ada', email: 'ada@example.com' },
  { id: '2', name: 'Grace', email: 'grace@example.com' },
];

function makeDataSource() {
  return {
    find: vi.fn(async () => ({ data: ROWS, total: ROWS.length, hasMore: false, pageSize: 50 })),
    getObjectSchema: vi.fn(async (name: string) => ({
      name,
      fields: {
        id: { type: 'text' },
        name: { type: 'text', label: 'Full name' },
        email: { type: 'text', label: 'Email address' },
      },
    })),
  } as any;
}

/** Author a spec ListView, bridge it, render the node the bridge produced. */
function bridgeAndRender(columns: unknown[]) {
  const node = new SpecBridge().transformListView({
    name: 'contacts_all',
    label: 'All Contacts',
    columns,
  });

  render(
    <ActionProvider>
      <ObjectGrid schema={{ ...node, objectName: 'contact' } as any} dataSource={makeDataSource()} />
    </ActionProvider>,
  );

  return node as any;
}

function headers(): string[] {
  return screen.getAllByRole('columnheader').map((h) => (h.textContent ?? '').trim());
}

describe('SpecBridge to ObjectGrid — bridged columns survive the seam (#5068)', () => {
  it('renders every column of a bridged view', async () => {
    bridgeAndRender([
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email' },
    ]);

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(headers()).toEqual(['#', 'Name', 'Email']);
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
  });

  it('emits the declared spelling — the node carries no adapter key', () => {
    // The producer pin. `accessorKey` is the data-table adapter's key, applied
    // by `ObjectGrid` on the way OUT; a producer of `object-grid` metadata must
    // not speak it on the way IN. Asserted on the node itself so a future
    // regression fails HERE, loudly, instead of one layer down as blank cells.
    const node = bridgeAndRender([{ field: 'name', label: 'Name' }]);

    expect(node.columns).toEqual([{ field: 'name', label: 'Name' }]);
    expect(Object.keys(node.columns[0])).not.toContain('accessorKey');
    expect(Object.keys(node.columns[0])).not.toContain('header');
  });

  it('lets the object schema label a bridged column the view left bare', async () => {
    // A consequence of speaking the declared spelling, not an addition: a bare
    // `{ field }` column reaches ObjectGrid's ListColumn arm, whose header
    // chain is `col.label` → the OBJECT FIELD's label → the prettified machine
    // name. The down-translation used to pre-empt that chain by writing
    // `header: col.label ?? col.field`, so a bridged view always rendered the
    // raw machine name where a directly authored object-grid rendered the
    // field's real (and localizable) label.
    bridgeAndRender([{ field: 'email' }]);

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(headers()).toEqual(['#', 'Email address']);
  });

  it('carries a bare string column through as a declared field column', async () => {
    // The spec's shorthand: `columns: ['name']`. Down-translated it became
    // `{ accessorKey: 'name', header: 'name' }` — a synthesized label nobody
    // authored. It is now the canonical `{ field: 'name' }`, and the header
    // comes from the object schema like any other bare column.
    const node = bridgeAndRender(['name']);

    expect(node.columns).toEqual([{ field: 'name' }]);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(headers()).toEqual(['#', 'Full name']);
  });
});
