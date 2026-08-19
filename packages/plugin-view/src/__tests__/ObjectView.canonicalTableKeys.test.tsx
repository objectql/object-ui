/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5102 — the canonical `table` keys take effect.
 *
 * `ObjectViewSchema.table` is documented as "inherits from ObjectGridSchema",
 * but `ObjectView` does not spread it: it forwards a hand-written whitelist of
 * keys. That whitelist carried only the DEPRECATED half of four pairs, and
 * dropped every canonical successor:
 *
 *   forwarded (legacy)   | canonical successor on ObjectGridSchema | forwarded?
 *   ---------------------|-----------------------------------------|-----------
 *   pageSize             | pagination: PaginationConfig            | NO
 *   selectable           | selection:  SelectionConfig             | NO
 *   defaultFilters       | filter                                  | NO
 *   defaultSort          | sort                                    | NO
 *
 * So an author writing the shape the type recommends — `table: { pagination:
 * { pageSize: 25 } }` — got a view that compiled, read correctly, and did
 * NOTHING. There was no failure signal anywhere: the key is declared on
 * `ObjectGridSchema`, `ObjectGrid` reads it, and only this forwarding hop lost
 * it. That silent-success shape is the defect, not the missing feature.
 *
 * Maintainer ruling of 2026-08-18 (verbatim 「同意」): extend the whitelist so
 * the canonical keys take effect, keeping the legacy spellings as WORKING
 * aliases. Both halves are pinned here — a fix that quietly retired the legacy
 * spelling would break every view authored against today's docs.
 *
 * PRECEDENCE, when an author writes both: the canonical key wins. Where
 * `ObjectView` itself resolves the pair (the non-grid fetch, and the delegated
 * `renderListView` schema) that choice is encoded in this file's `||` chains
 * and pinned below. On the grid path `ObjectView` forwards BOTH slots and
 * `ObjectGrid` arbitrates — it already resolves all four pairs canonical-first
 * (`schema.pagination?.pageSize ?? schema.pageSize`; `if (schema.selection
 * ?.type) … else if (schema.selectable !== undefined)`; `schemaFilter !==
 * undefined ? … : schema.defaultFilters`; `schemaSort ?? (schema.defaultSort
 * ? [schema.defaultSort] : undefined)`). Re-resolving the pair here instead
 * would have made the two layers disagree, and synthesising a `pagination`
 * object out of a legacy `pageSize` would flip `ObjectGrid`'s
 * `paginationEnabled` (`schema.pagination !== undefined ? true : …`) for every
 * view that only ever wrote the legacy key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';

vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    SchemaRenderer: ({ schema }: any) => <div data-testid="schema-renderer">{schema?.type}</div>,
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});

/**
 * The grid the view delegates to, replaced by a probe that records the schema
 * it was handed. What reaches this object IS the forwarding whitelist.
 */
const gridSchemas: any[] = [];
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: ({ schema }: any) => {
    gridSchemas.push(schema);
    return <div data-testid="object-grid" />;
  },
}));
vi.mock('@object-ui/plugin-form', () => ({ ObjectForm: () => <div data-testid="object-form" /> }));

const mockDataSource = () => ({
  find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue({ name: 'task', fields: {} }),
});

/** Render on the grid path and return the schema ObjectGrid was handed. */
function forwardedGridSchema(schema: Partial<ObjectViewSchema>): any {
  gridSchemas.length = 0;
  render(
    <ObjectView
      schema={{ type: 'object-view', objectName: 'task', ...schema } as ObjectViewSchema}
      dataSource={mockDataSource() as any}
    />,
  );
  return gridSchemas[0];
}

/** Render on a NON-grid path (ObjectView fetches for itself) and return `find`. */
function nonGridFind(schema: Partial<ObjectViewSchema>) {
  const ds = mockDataSource();
  render(
    <ObjectView
      schema={{
        type: 'object-view',
        objectName: 'task',
        // Anything but `grid` — the grid path delegates its fetch to ObjectGrid.
        defaultViewType: 'calendar',
        ...schema,
      } as ObjectViewSchema}
      dataSource={ds as any}
    />,
  );
  return ds.find;
}

async function queryParams(find: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(find).toHaveBeenCalled());
  return find.mock.calls[0][1];
}

/** Render through the delegated `renderListView` slot and return its schema. */
function delegatedSchema(schema: Partial<ObjectViewSchema>): any {
  const seen: any[] = [];
  render(
    <ObjectView
      schema={{ type: 'object-view', objectName: 'task', ...schema } as ObjectViewSchema}
      dataSource={mockDataSource() as any}
      renderListView={({ schema: s }: any) => { seen.push(s); return <div data-testid="delegated" />; }}
    />,
  );
  return seen[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  gridSchemas.length = 0;
});

describe('grid path: the canonical table keys reach ObjectGrid', () => {
  // Each of these four was `undefined` on the forwarded schema before
  // objectui#5102 — the value the author wrote never left ObjectView.
  it('forwards table.pagination', () => {
    const grid = forwardedGridSchema({ table: { pagination: { pageSize: 25 } } as any });
    expect(grid.pagination).toEqual({ pageSize: 25 });
  });

  it('forwards table.pagination.pageSizeOptions along with it', () => {
    const grid = forwardedGridSchema({
      table: { pagination: { pageSize: 25, pageSizeOptions: [25, 50] } } as any,
    });
    expect(grid.pagination).toEqual({ pageSize: 25, pageSizeOptions: [25, 50] });
  });

  it('forwards table.selection', () => {
    const grid = forwardedGridSchema({ table: { selection: { type: 'multiple' } } as any });
    expect(grid.selection).toEqual({ type: 'multiple' });
  });

  it('forwards table.filter', () => {
    const grid = forwardedGridSchema({ table: { filter: [['stage', '=', 'won']] } as any });
    expect(grid.filter).toEqual([['stage', '=', 'won']]);
  });

  it('forwards table.sort', () => {
    const grid = forwardedGridSchema({ table: { sort: [{ field: 'name', order: 'desc' }] } as any });
    expect(grid.sort).toEqual([{ field: 'name', order: 'desc' }]);
  });

  it('forwards the string form of table.sort', () => {
    // `ObjectGridSchema.sort` is `string | SortConfig[]`; the legacy
    // `defaultSort` has no string form, so this arity is reachable only
    // through the canonical key.
    const grid = forwardedGridSchema({ table: { sort: 'name desc' } as any });
    expect(grid.sort).toBe('name desc');
  });
});

describe('grid path: the legacy spellings still work', () => {
  it('still forwards table.pageSize', () => {
    expect(forwardedGridSchema({ table: { pageSize: 25 } as any }).pageSize).toBe(25);
  });

  it('still forwards table.selectable', () => {
    expect(forwardedGridSchema({ table: { selectable: true } as any }).selectable).toBe(true);
  });

  it('still forwards table.defaultFilters', () => {
    const grid = forwardedGridSchema({ table: { defaultFilters: { status: 'active' } } as any });
    expect(grid.defaultFilters).toEqual({ status: 'active' });
  });

  it('still forwards table.defaultSort', () => {
    const grid = forwardedGridSchema({ table: { defaultSort: { field: 'name', order: 'asc' } } as any });
    expect(grid.defaultSort).toEqual({ field: 'name', order: 'asc' });
  });

  it('leaves a canonical slot empty when only the legacy key is written', () => {
    // The alias must not be re-emitted into the canonical slot: `ObjectGrid`
    // keys `paginationEnabled` off `schema.pagination !== undefined`, so a
    // synthesised `pagination` would turn pagination on for legacy authors.
    const grid = forwardedGridSchema({
      table: { pageSize: 25, selectable: true, defaultFilters: { a: 1 }, defaultSort: { field: 'n', order: 'asc' } } as any,
    });
    expect(grid.pagination).toBeUndefined();
    expect(grid.selection).toBeUndefined();
    expect(grid.filter).toBeUndefined();
    expect(grid.sort).toBeUndefined();
  });
});

describe('grid path: both spellings written — each rides its own slot', () => {
  // ObjectView forwards both and ObjectGrid arbitrates canonical-first (see the
  // file header for the four expressions). What is pinned here is ObjectView's
  // half: the canonical value must arrive in the canonical slot, or the
  // downstream rule has nothing to prefer.
  it('puts the canonical value in the canonical slot and the alias in the legacy one', () => {
    const grid = forwardedGridSchema({
      table: {
        pagination: { pageSize: 25 },
        pageSize: 10,
        selection: { type: 'multiple' },
        selectable: false,
        filter: [['stage', '=', 'won']],
        defaultFilters: { stage: 'lost' },
        sort: [{ field: 'name', order: 'desc' }],
        defaultSort: { field: 'created', order: 'asc' },
      } as any,
    });
    expect(grid.pagination).toEqual({ pageSize: 25 });
    expect(grid.pageSize).toBe(10);
    expect(grid.selection).toEqual({ type: 'multiple' });
    expect(grid.selectable).toBe(false);
    expect(grid.filter).toEqual([['stage', '=', 'won']]);
    expect(grid.defaultFilters).toEqual({ stage: 'lost' });
    expect(grid.sort).toEqual([{ field: 'name', order: 'desc' }]);
    expect(grid.defaultSort).toEqual({ field: 'created', order: 'asc' });
  });
});

describe('grid path: a named view still outranks the table segment', () => {
  // The FILTER segments ahead of `table` (`listViews` entry, then `activeView`)
  // are untouched by objectui#5102 — they keep riding the legacy slot. The
  // canonical slot must therefore stay EMPTY while one of them is active:
  // ObjectGrid prefers the canonical slot, so a `table.filter` forwarded
  // unconditionally would outrank the view the user is looking at.
  //
  // The SORT half moved in objectui#5270 — see the sort assertion below for
  // why, and `ObjectView.namedViewSortArity.test.tsx` for the two consumers
  // that made the old slot unreadable. What is pinned here either way is the
  // PRECEDENCE, which the move preserves: the view still outranks `table`.
  const namedView = {
    listViews: {
      won: {
        label: 'Won',
        filter: [['stage', '=', 'won']],
        sort: [{ field: 'name', order: 'desc' }],
      },
    },
    defaultListView: 'won',
  };

  it('keeps the named view filter in force over a table.filter', () => {
    const grid = forwardedGridSchema({
      ...namedView,
      table: { filter: [['stage', '=', 'lost']] } as any,
    } as any);
    expect(grid.filter).toBeUndefined();
    expect(grid.defaultFilters).toEqual([['stage', '=', 'won']]);
  });

  it('keeps the named view sort in force over a table.sort', () => {
    // objectui#5102 pinned this as `sort: undefined` +
    // `defaultSort: [{ field: 'name', order: 'desc' }]` and said in so many
    // words that the pin should be UPDATED, not deleted, by whoever fixed the
    // arity. Updated here: the array now rides the canonical slot — the only
    // one of the two whose declared type (`string | SortConfig[]`) can hold
    // more than one key — and the legacy slot carries the `table` segment
    // alone. Precedence is what this block asserts and it is unchanged:
    // ObjectGrid resolves `schemaSort ?? defaultSort`, so the named view wins
    // over `table.sort` because it is what reaches the canonical slot.
    const grid = forwardedGridSchema({
      ...namedView,
      table: { sort: 'created asc' } as any,
    } as any);
    expect(grid.sort).toEqual([{ field: 'name', order: 'desc' }]);
    expect(grid.defaultSort).toBeUndefined();
  });

  it('keeps the named view sort in force over a legacy table.defaultSort too', () => {
    // The other side of the same precedence: the `table` segment holds the
    // legacy slot alone, and ObjectGrid prefers the canonical one, so the view
    // still wins. Without this the move could have inverted the pair silently.
    const grid = forwardedGridSchema({
      ...namedView,
      table: { defaultSort: { field: 'created', order: 'asc' } } as any,
    } as any);
    expect(grid.sort).toEqual([{ field: 'name', order: 'desc' }]);
    expect(grid.defaultSort).toEqual({ field: 'created', order: 'asc' });
  });
});

describe('non-grid path: ObjectView resolves the pair itself, canonical first', () => {
  // Calendar / kanban / gallery / timeline fetch through ObjectView, so the
  // precedence chosen for this card is directly observable on the wire here.
  it('queries with a canonical table.filter', async () => {
    const params = await queryParams(nonGridFind({ table: { filter: [['stage', '=', 'won']] } as any }));
    expect(params.$filter).toEqual([['stage', '=', 'won']]);
  });

  it('lowers a ViewFilterRule[] table.filter through the shared sink', async () => {
    // Same treatment `table.defaultFilters` already gets — the canonical key
    // reaches `$filter` as AST, not as bare rule objects (objectui#3431).
    const params = await queryParams(
      nonGridFind({ table: { filter: [{ field: 'stage', operator: 'eq', value: 'won' }] } as any }),
    );
    expect(params.$filter).toEqual([['stage', 'equals', 'won']]);
  });

  it('prefers table.filter over table.defaultFilters', async () => {
    const params = await queryParams(
      nonGridFind({
        table: { filter: [['stage', '=', 'won']], defaultFilters: { stage: 'lost' } } as any,
      }),
    );
    expect(params.$filter).toEqual([['stage', '=', 'won']]);
  });

  it('still queries with table.defaultFilters alone', async () => {
    const params = await queryParams(nonGridFind({ table: { defaultFilters: { status: 'active' } } as any }));
    expect(params.$filter).toEqual(['status', '=', 'active']);
  });

  it('orders by a canonical table.sort', async () => {
    const params = await queryParams(nonGridFind({ table: { sort: [{ field: 'name', order: 'desc' }] } as any }));
    expect(params.$orderby).toEqual([{ field: 'name', order: 'desc' }]);
  });

  it('prefers table.sort over table.defaultSort', async () => {
    const params = await queryParams(
      nonGridFind({
        table: { sort: [{ field: 'name', order: 'desc' }], defaultSort: { field: 'created', order: 'asc' } } as any,
      }),
    );
    expect(params.$orderby).toEqual([{ field: 'name', order: 'desc' }]);
  });

  it('still orders by table.defaultSort alone', async () => {
    const params = await queryParams(nonGridFind({ table: { defaultSort: { field: 'created', order: 'asc' } } as any }));
    expect(params.$orderby).toEqual({ field: 'created', order: 'asc' });
  });
});

describe('delegated renderListView: canonical first, alias still working', () => {
  it('hands over a canonical table.filter', () => {
    expect(delegatedSchema({ table: { filter: [['stage', '=', 'won']] } as any }).filter)
      .toEqual([['stage', '=', 'won']]);
  });

  it('prefers table.filter over table.defaultFilters', () => {
    const s = delegatedSchema({
      table: { filter: [['stage', '=', 'won']], defaultFilters: { stage: 'lost' } } as any,
    });
    expect(s.filter).toEqual([['stage', '=', 'won']]);
  });

  it('still hands over table.defaultFilters alone', () => {
    expect(delegatedSchema({ table: { defaultFilters: { status: 'active' } } as any }).filter)
      .toEqual({ status: 'active' });
  });

  it('hands over a canonical table.sort and prefers it over table.defaultSort', () => {
    expect(delegatedSchema({ table: { sort: 'name desc' } as any }).sort).toBe('name desc');
    const s = delegatedSchema({
      table: { sort: 'name desc', defaultSort: { field: 'created', order: 'asc' } } as any,
    });
    expect(s.sort).toBe('name desc');
  });

  it('still hands over table.defaultSort alone', () => {
    expect(delegatedSchema({ table: { defaultSort: { field: 'created', order: 'asc' } } as any }).sort)
      .toEqual({ field: 'created', order: 'asc' });
  });
});
