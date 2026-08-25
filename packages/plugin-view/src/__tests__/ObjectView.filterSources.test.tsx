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

  // Spelled `order`, the key `ObjectGridSchema.defaultSort` actually declares
  // (`packages/types/src/objectql.ts`, and the zod mirror agrees). It used to
  // say `direction` — a spelling this surface never declared, retired
  // repo-wide by objectui#5293 / objectui#6011. Re-spelling changes nothing
  // this test grades: the assertion pins VERBATIM pass-through and never reads
  // the direction key, so any word passed. The remaining `as any` is about
  // ARITY, not spelling — `defaultSort` is declared a single `{ field, order }`
  // and this passes an array on purpose (see ObjectView.namedViewSortArity for
  // what the arity costs elsewhere).
  it('forwards the sort alongside it', () => {
    const seen = renderDelegated({ table: { defaultSort: [{ field: 'name', order: 'asc' }] } as any });
    expect(seen[0]?.sort).toEqual([{ field: 'name', order: 'asc' }]);
  });

  it('forwards nothing when the view declares neither', () => {
    const seen = renderDelegated({});
    expect(seen[0]?.filter).toBeUndefined();
    expect(seen[0]?.sort).toBeUndefined();
  });
});
