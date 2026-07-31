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

  it('keeps a ViewFilterRule[] table.defaultFilters', async () => {
    const rules = [{ field: 'stage', operator: 'eq', value: 'won' }];
    const find = renderCalendar({ table: { defaultFilters: rules } as any });
    expect(await queriedFilter(find)).toEqual(rules);
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
