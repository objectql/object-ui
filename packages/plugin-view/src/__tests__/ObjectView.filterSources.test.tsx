/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The filter a non-grid view actually queries with.
 *
 * `ObjectView` fetches its own data for calendar / kanban / gallery / timeline
 * (grid delegates to `ObjectGrid`). It built the filter by hand and lost it in
 * two ways, both silent:
 *
 *   1. `baseFilter.length > 0` — `undefined > 0` for an object. So a
 *      `table.defaultFilters`, declared `Record<string, any>`, was dropped and
 *      the view returned EVERY record. `ObjectGrid` assigns the same value
 *      straight to `params.$filter`, so one view definition filtered correctly
 *      as a grid and returned everything as a calendar.
 *   2. `['and', ...baseFilter, ...userFilter]` — spreading a `ViewFilterRule[]`
 *      puts bare rule objects where the AST expects nodes. Covered at the merge
 *      level in core's `filter-source-merge.test.ts`, which pins what the server
 *      does with the old shape.
 *   3. Even UNSPREAD, a `ViewFilterRule[]` was never AST: it reached `$filter`
 *      as rule objects and the server answered `400 INVALID_FILTER`
 *      (objectui#3431). This file is one of the two producers that feed the
 *      shared `toFilterNode` sink — the other is `plugin-list`'s
 *      `buildEffectiveFilter` — which is why the lowering lives there and not
 *      in either caller.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { convertSortToQueryParams } from '@object-ui/core';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';

vi.mock('@object-ui/react', async (importOriginal) => {
  const React = await import('react');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    SchemaRenderer: ({ schema }: any) => <div data-testid="schema-renderer">{schema?.type}</div>,
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});
vi.mock('@object-ui/plugin-grid', () => ({ ObjectGrid: () => <div data-testid="object-grid" /> }));
vi.mock('@object-ui/plugin-form', () => ({ ObjectForm: () => <div data-testid="object-form" /> }));

function renderCalendar(schema: Partial<ObjectViewSchema>) {
  const find = vi.fn().mockResolvedValue({ data: [], total: 0 });
  const ds: any = {
    find,
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'task', fields: {} }),
  };
  render(
    <ObjectView
      schema={{
        type: 'object-view',
        objectName: 'task',
        // Anything but `grid` — grid delegates its fetch to ObjectGrid, and
        // `defaultViewType` is the key `currentViewType` actually reads.
        defaultViewType: 'calendar',
        ...schema,
      } as ObjectViewSchema}
      dataSource={ds}
    />,
  );
  return find;
}

/** The `$filter` the view actually queried with. */
async function queriedFilter(find: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(find).toHaveBeenCalled());
  return find.mock.calls[0][1]?.$filter;
}

describe('ObjectView carries every filter source into the query', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps an OBJECT table.defaultFilters instead of dropping it', async () => {
    const find = renderCalendar({ table: { defaultFilters: { status: 'active' } } as any });
    // Was `undefined` — the view queried unfiltered and showed every record.
    expect(await queriedFilter(find)).toEqual(['status', '=', 'active']);
  });

  it('LOWERS a ViewFilterRule[] table.defaultFilters into AST nodes', async () => {
    // objectui#3431. This case used to assert `toEqual(rules)` — that the rule
    // objects reached `$filter` VERBATIM — and it was green because that is
    // what happened, not because it was right: the server refuses an array of
    // rule objects with `400 INVALID_FILTER`, so this view queried nothing at
    // all. `toFilterNode` now lowers the rules; `eq` canonicalises to `equals`
    // through the spec's own `normalizeFilterOperator`, the same exit the
    // write side uses.
    const rules = [{ field: 'stage', operator: 'eq', value: 'won' }];
    const find = renderCalendar({ table: { defaultFilters: rules } as any });
    expect(await queriedFilter(find)).toEqual([['stage', 'equals', 'won']]);
  });

  it('keeps an AST-shaped source', async () => {
    const find = renderCalendar({ table: { defaultFilters: [['stage', '=', 'won']] } as any });
    expect(await queriedFilter(find)).toEqual([['stage', '=', 'won']]);
  });

  it('sends no filter when the view declares none', async () => {
    expect(await queriedFilter(renderCalendar({}))).toBeUndefined();
  });

  it('sends no filter for an empty source rather than an empty array', async () => {
    expect(await queriedFilter(renderCalendar({ table: { defaultFilters: {} } as any }))).toBeUndefined();
    expect(await queriedFilter(renderCalendar({ table: { defaultFilters: [] } as any }))).toBeUndefined();
  });
});

/**
 * `mergedFilters` / `mergedSort` — what ObjectView hands the renderer it
 * delegates to (the `renderListView` slot, used by the Studio design surface).
 *
 * Both used to open with a branch keyed on ObjectView's own filter/sort state,
 * and the filter one REPLACED the view's filter with the user's rather than
 * combining them. Nothing ever wrote that state, so neither branch could run —
 * they were deleted rather than corrected, because the delegated renderer owns
 * the filter UI and does its own combining. These pin what survives.
 */
describe('ObjectView hands the view filter to the delegated renderer', () => {
  beforeEach(() => vi.clearAllMocks());

  function renderDelegated(schema: Partial<ObjectViewSchema>) {
    const seen: any[] = [];
    const ds: any = {
      find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({ name: 'task', fields: {} }),
    };
    render(
      <ObjectView
        schema={{ type: 'object-view', objectName: 'task', ...schema } as ObjectViewSchema}
        dataSource={ds}
        renderListView={({ schema: s }: any) => { seen.push(s); return <div data-testid="delegated" />; }}
      />,
    );
    return seen;
  }

  it('forwards an object table.defaultFilters unchanged', () => {
    const seen = renderDelegated({ table: { defaultFilters: { status: 'active' } } as any });
    expect(seen[0]?.filter).toEqual({ status: 'active' });
  });

  it('forwards a ViewFilterRule[] unchanged', () => {
    const rules = [{ field: 'stage', operator: 'eq', value: 'won' }];
    const seen = renderDelegated({ table: { defaultFilters: rules } as any });
    expect(seen[0]?.filter).toEqual(rules);
  });

  // ⚠️ CONTROL, green in BOTH states — named so it is not read as evidence
  // for objectui#6235. `table.sort` is the slot that legitimately carries an
  // array (`ObjectGridSchema.sort: string | SortConfig[]`), and it must reach
  // the delegated node UNWRAPPED. What this guards is the wrong shape the fix
  // could have taken: wrapping the chain's RESULT instead of its final branch,
  // which would re-wrap this into `[[{ field, order }]]` — verbatim
  // objectui#5270's failure, where `parseSchemaSort` and
  // `ListView.parseSortConfig` both skip a nested-array entry and return `[]`,
  // so the user sees no sort at all. Only the LAST branch may change shape;
  // this cell is how we know it was the only one.
  it('forwards a canonical table.sort array UNWRAPPED', () => {
    const seen = renderDelegated({ table: { sort: [{ field: 'name', order: 'asc' }] } as any });
    expect(seen[0]?.sort).toEqual([{ field: 'name', order: 'asc' }]);
    expect(convertSortToQueryParams(seen[0]?.sort)).toEqual({ name: 'asc' });
  });

  // This cell used to be `forwards the sort alongside it`, and it asserted that
  // an ARRAY in `table.defaultSort` reached the delegated slot verbatim. Two
  // things were wrong with it, both recorded by objectui#6235:
  //
  //   1. It could not fail in either state — a verbatim `toEqual` on a verbatim
  //      pass-through (objectui#5270's recorded trap).
  //   2. Its input is metadata the schema REFUSES.
  //      `packages/types/src/zod/objectql.zod.ts` declares
  //      `defaultSort: z.object({ field, order })` — not a union, not an array —
  //      so no conforming author can produce what it was pinning.
  //
  // The wrap lowers it verbatim as the non-grid fetch path and `ObjectGrid` do
  // for this exact pair, which means invalid input stays invalid instead of
  // being rescued. That is the point, not a gap: the shared sink REFUSES it
  // rather than guessing, which is the 2026-08-22 ruling's whole basis.
  // ⛔ Do not "fix" this with an `Array.isArray` flatten in the caller — that
  // is a tolerant second dialect for input the protocol already rejects, and it
  // would make this surface disagree with both of its siblings again.
  it('does not rescue an ARRAY in defaultSort — the arity the schema refuses', () => {
    const seen = renderDelegated({ table: { defaultSort: [{ field: 'name', order: 'asc' }] } as any });
    expect(seen[0]?.sort).toEqual([[{ field: 'name', order: 'asc' }]]);
    // Refused, not guessed — the same answer `:862` and ObjectGrid give it.
    expect(convertSortToQueryParams(seen[0]?.sort)).toBeUndefined();
  });

  // ── objectui#6235 — the DECLARED arity, which is where the defect lived ────
  //
  // Everything above hands `defaultSort` an array. `ObjectGridSchema` declares
  // it a SINGLE `{ field, order }` object, and that shape — the only one an
  // author following the type can write — was forwarded BARE into a slot
  // declared `string | SortConfig[]` (`list-view`'s `sort`, imported by
  // reference from the spec's own `ListViewSchema`). No compile-time witness:
  // `ObjectViewSchema.table` is a bare index signature (objectui#5102) and the
  // `renderListView` slot types `schema` as `any` (objectui#5097).
  //
  // These two cells are the discriminating ones. Against `origin/main` the
  // first reads `{ field: 'created', order: 'asc' }` and the second reads
  // `undefined`; both are green only with the wrap at `mergedSort`.
  it('WRAPS a bare-object table.defaultSort into the SortConfig[] the slot declares', () => {
    const seen = renderDelegated({ table: { defaultSort: { field: 'created', order: 'asc' } } as any });
    // Before objectui#6235 this was the bare object — the arity the slot does
    // not declare, and the one three of the four chain branches never produce.
    expect(seen[0]?.sort).toEqual([{ field: 'created', order: 'asc' }]);
  });

  it('hands the delegated slot a sort its READERS can actually parse', () => {
    // The symptom, not the shape. A verbatim pass-through assertion cannot
    // fail in either state (objectui#5270's recorded trap, and the cell above
    // this block is the resident example), so this one runs the forwarded
    // value through a real reader of that slot instead.
    //
    // `convertSortToQueryParams` is the repo's ONE sort sink and is what the
    // delegated node's `sort` ultimately reaches on every non-grid view type
    // (`ObjectCalendar` / `ObjectMap` / `ObjectTimeline` / `ObjectGantt` each
    // call it on `schema.sort`). It refuses a bare `{ field, order }` BY
    // DESIGN — the 2026-08-22 maintainer ruling rejected widening it, because
    // the same slot legitimately carries `$orderby`'s own
    // `Record<field, direction>` map where `{ field: 'desc' }` orders by a
    // column named `field`. So the caller must wrap, and until it did, the
    // sink returned `undefined`: a silently UNSORTED list, no error anywhere.
    // `ListView.parseSortConfig` and `ObjectGrid.parseSchemaSort` — the two
    // readers the in-tree hosts reach through — fail the same way, returning
    // `[]` from the same `Array.isArray(sort) ? sort : []` opening.
    const seen = renderDelegated({ table: { defaultSort: { field: 'created', order: 'asc' } } as any });
    expect(convertSortToQueryParams(seen[0]?.sort)).toEqual({ created: 'asc' });
  });

  it('keeps the canonical table.sort ahead of the wrapped legacy default', () => {
    // CONTROL — green in both states. Named so it is not read as evidence for
    // the fix: it guards the wrong shape where the wrap is written so that the
    // `defaultSort` branch starts winning (e.g. by wrapping the chain's result
    // rather than its final branch, making the always-truthy array outrank
    // everything). Precedence is the half of `mergedSort` that must NOT move.
    const seen = renderDelegated({
      table: { sort: [{ field: 'name', order: 'desc' }], defaultSort: { field: 'created', order: 'asc' } } as any,
    });
    expect(seen[0]?.sort).toEqual([{ field: 'name', order: 'desc' }]);
  });

  it('forwards nothing when the view declares neither', () => {
    // CONTROL — green in both states. Guards the other wrong shape: an
    // unconditional `[schema.table.defaultSort]`, which forwards `[undefined]`
    // when nothing was authored. That is truthy and one entry long, so the
    // sink and both parsers would report a sort that does not exist.
    const seen = renderDelegated({});
    expect(seen[0]?.filter).toBeUndefined();
    expect(seen[0]?.sort).toBeUndefined();
    expect(convertSortToQueryParams(seen[0]?.sort)).toBeUndefined();
  });
});
