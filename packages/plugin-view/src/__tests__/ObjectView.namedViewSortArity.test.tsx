/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5270 — a named view's `sort` is an ARRAY, and it used to be handed
 * to a slot declared to hold ONE key.
 *
 * `NamedListView.sort` is `Array< { field, order } >`. `ObjectView` forwarded
 * the resolved view sort into `gridSchema.defaultSort`, which
 * `ObjectGridSchema` declares as a single `{ field: string; order: 'asc' |
 * 'desc' }`. Nothing complained — `ObjectViewSchema.table` collapses to a bare
 * index signature (objectui#5102), so the arity mismatch had no compile-time
 * witness — and BOTH of `ObjectGrid`'s readers then failed, in different ways:
 *
 *   header  `parseSchemaSort(schemaSort ?? (schema.defaultSort ?
 *           [schema.defaultSort] : undefined))` re-wraps an already-array
 *           `defaultSort` into `[[{ field, order }]]`. `parseSchemaSort`
 *           accepts a string or an object with a string `field` per entry; a
 *           nested ARRAY is neither, so the entry is skipped and the parse
 *           returns `[]`. The user saw NO sort indicator at all.
 *   fetch   `` params.$orderby = `${(schema.defaultSort as any).field} ${…
 *           .order}` `` reads two absent keys off an array, so the request
 *           carried the literal string `"undefined undefined"`.
 *
 * The fix routes the view segments into the CANONICAL `sort` slot, declared
 * `string | SortConfig[]` — the arity a view actually carries, and the same
 * spelling the shared sort sink `convertSortToQueryParams` accepts
 * (objectui#4869), so no fourth dialect is introduced to make this work.
 *
 * These tests drive the REAL `ObjectGrid` rather than a probe that records the
 * forwarded schema: the defect was invisible in the forwarded object (the array
 * was right there, in the wrong slot) and only appeared at the two consumers.
 * Pinning the forwarded shape alone would have re-pinned the bug.
 *
 * Resolution note for anyone running an ablation on this file: nothing here
 * goes through a build. `../ObjectView` is a relative source import, and
 * `@object-ui/plugin-grid` / `@object-ui/components` / `@object-ui/core` are
 * aliased to each package's own `src` directory in the root
 * `vitest.config.mts`, so a stale `dist` build cannot make a reverted source
 * read green.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectView } from '../ObjectView';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';
import type { ObjectViewSchema } from '@object-ui/types';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false) as any;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

function makeDataSource() {
  const find = vi.fn(async () => ({
    data: [
      { id: 'a', name: 'Alpha', status: 'open' },
      { id: 'b', name: 'Beta', status: 'open' },
    ],
    total: 2,
  }));
  return {
    find,
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async (name: string) => ({
      name,
      label: 'Task',
      fields: {
        name: { label: 'Name', type: 'text' },
        status: { label: 'Status', type: 'text' },
      },
    })),
  } as any;
}

/** A view whose sort lives on a named `listViews` entry — the card's subject. */
const namedViewSchema = (sort: unknown): ObjectViewSchema =>
  ({
    type: 'object-view',
    objectName: 'task',
    listViews: {
      won: { label: 'Won', columns: ['name', 'status'], sort },
    },
    defaultListView: 'won',
  }) as unknown as ObjectViewSchema;

function renderView(schema: ObjectViewSchema, ds: any) {
  return render(
    <ActionProvider>
      <ObjectView schema={schema} dataSource={ds} />
    </ActionProvider>,
  );
}

const lastFindParams = (ds: any) =>
  ds.find.mock.calls[ds.find.mock.calls.length - 1][1];

const headerCell = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('thead th')).find((th) =>
    th.textContent?.includes(label),
  ) as HTMLElement;

describe("objectui#5270 — a named view's sort reaches the grid", () => {
  it('draws the declared sort indicator before anyone clicks', async () => {
    // Half one. The array used to be re-wrapped to `[[…]]` and parsed to `[]`,
    // so the column the view was sorted by showed no arrow — and the first
    // click on it then asked for `asc` on a list already ordered `desc`.
    const ds = makeDataSource();
    const { container } = renderView(
      namedViewSchema([{ field: 'name', order: 'desc' }]),
      ds,
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    const name = headerCell(container, 'Name');
    expect(name).toBeTruthy();
    expect(name.querySelector('[class*="chevron-down"]')).not.toBeNull();
  });

  it('sends the declared sort as $orderby, not the string "undefined undefined"', async () => {
    // Half two. `${arr.field} ${arr.order}` on an array is two `undefined`s,
    // and the resulting `"undefined undefined"` reached the wire verbatim —
    // `serializeOrderBy` passes a non-empty string through untouched, so the
    // server got an unparseable sort rather than none.
    const ds = makeDataSource();
    renderView(namedViewSchema([{ field: 'name', order: 'desc' }]), ds);

    await waitFor(() => expect(ds.find).toHaveBeenCalled());
    await waitFor(() => {
      expect(lastFindParams(ds).$orderby).toBe('name desc');
    });
    expect(lastFindParams(ds).$orderby).not.toBe('undefined undefined');
    expect(String(lastFindParams(ds).$orderby)).not.toContain('undefined');
  });

  it('carries every key of a multi-key sort, which the legacy slot could not hold', async () => {
    // The arity is the whole point: `defaultSort` is ONE `{ field, order }`,
    // so a two-key view sort had nowhere to land even if the single-key case
    // had somehow been made to work.
    const ds = makeDataSource();
    const { container } = renderView(
      namedViewSchema([
        { field: 'status', order: 'asc' },
        { field: 'name', order: 'desc' },
      ]),
      ds,
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    await waitFor(() => {
      expect(lastFindParams(ds).$orderby).toBe('status asc, name desc');
    });
    expect(headerCell(container, 'Status').querySelector('[class*="chevron-up"]')).not.toBeNull();
    expect(headerCell(container, 'Name').querySelector('[class*="chevron-down"]')).not.toBeNull();
  });

  it("still honours a table.defaultSort when no view supplies one", async () => {
    // The legacy `table` slot keeps working: it is the one shape `defaultSort`
    // was always declared to hold, and this fix narrows what is written into
    // it rather than retiring it.
    const ds = makeDataSource();
    const { container } = renderView(
      {
        type: 'object-view',
        objectName: 'task',
        table: { columns: ['name', 'status'], defaultSort: { field: 'name', order: 'desc' } },
      } as unknown as ObjectViewSchema,
      ds,
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    await waitFor(() => expect(lastFindParams(ds).$orderby).toBe('name desc'));
    expect(headerCell(container, 'Name').querySelector('[class*="chevron-down"]')).not.toBeNull();
  });
});
