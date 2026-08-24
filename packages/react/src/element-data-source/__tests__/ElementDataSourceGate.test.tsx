/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The mapping half of `PageComponentSchema.dataSource` (objectstack#6953).
 *
 * `useElementDataSource` resolves the binding; this module writes the composed
 * result onto the schema keys a given block reads. Two properties are pinned
 * here because every block wiring depends on them and none of the per-block
 * suites can see them:
 *
 *  1. **The precedence table is one table.** Binding beats component key, view
 *     is only a baseline, `filter` AND-combines instead of replacing. Eight
 *     blocks share it, so it is asserted once at the source rather than eight
 *     times through eight renderers.
 *  2. **An unmapped key is never written.** A mapping names only the keys its
 *     block actually reads; writing a composed value onto a key the block
 *     ignores would recreate the defect this wiring removes — a value accepted
 *     and silently dropped — one layer deeper, where nothing reports it. The
 *     `object-kanban` / `object-chart` / `object-metric` wirings are exactly
 *     that case, so "does not write what it was not told to" is a pin, not a
 *     nicety.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  ElementDataSourceGate,
  noDataSourceMessage,
  useElementDataSourceSchema,
  useResolvedDataSource,
  type ElementDataSourceMapping,
} from '../ElementDataSourceGate';
import { SchemaRendererProvider } from '../../context/SchemaRendererContext';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot accounts',
  type: 'kanban',
  columns: ['name', 'rating'],
  filter: [['rating', '=', 'hot']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

/** An adapter that can answer "what saved views does this object have?". */
const makeAdapter = (listViews: Record<string, unknown> = { hot: HOT_VIEW }) => ({
  find: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue({ name: 'account', listViews }),
});

const FULL: ElementDataSourceMapping = {
  columns: true,
  filter: true,
  sort: true,
  limit: 'pagination.pageSize',
  viewType: true,
};

function useBound(schema: unknown, mapping: ElementDataSourceMapping, adapter: unknown) {
  return useElementDataSourceSchema(schema as Record<string, any>, mapping, adapter);
}

const resolved = async (schema: unknown, mapping: ElementDataSourceMapping, adapter?: unknown) => {
  const { result } = renderHook(() => useBound(schema, mapping, adapter ?? makeAdapter()));
  await waitFor(() => expect(result.current.status).not.toBe('loading'));
  return result;
};

describe('useElementDataSourceSchema — no binding', () => {
  it('returns the schema BY REFERENCE so the block is not remounted', () => {
    const schema = { type: 'object-grid', objectName: 'task' };
    const { result } = renderHook(() => useBound(schema, FULL, makeAdapter()));
    expect(result.current.status).toBe('absent');
    // Identity, not deep equality: a fresh object every render would give the
    // block a new schema each time — remount, refetch, lost scroll.
    expect(result.current.schema).toBe(schema);
  });

  it('never mistakes the spec BINDING passed as the adapter for an adapter', async () => {
    // The name collision, from the other side: a host (or an older cached
    // bundle) handing the gate the binding under the adapter argument used to
    // make a real saved view report as unresolvable ("this data source cannot
    // list the saved views"). The context adapter is used instead.
    const { result } = renderHook(() =>
      useBound(
        { dataSource: { object: 'account', view: 'hot' } },
        FULL,
        { object: 'account', view: 'hot' },
      ),
    );
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    // No context provider in this harness, so the honest answer is "nobody here
    // can list views" — but crucially NOT via the binding-as-adapter path, and
    // the message names that fact rather than claiming the view is absent.
    expect(result.current.status).toBe('missing');
    expect(result.current.error).toContain('cannot list the saved views');
  });

  it('treats a runtime ADAPTER parked under `dataSource` as no binding', () => {
    // The two collide by name; `isElementDataSourceConfig` is what tells them
    // apart, and a host handing us the adapter must not be read as metadata.
    const schema = { type: 'object-grid', objectName: 'task', dataSource: { find: () => [] } };
    const { result } = renderHook(() => useBound(schema, FULL, makeAdapter()));
    expect(result.current.status).toBe('absent');
    expect(result.current.schema).toBe(schema);
  });
});

describe('useElementDataSourceSchema — binding without a view', () => {
  it('maps `object` onto `objectName` and needs no fetch to do it', () => {
    const { result } = renderHook(() =>
      useBound({ type: 'object-grid', dataSource: { object: 'account' } }, FULL, makeAdapter()),
    );
    expect(result.current.status).toBe('ready');
    expect(result.current.schema.objectName).toBe('account');
  });

  it('maps `object` onto a block-specific key when the mapping names one', () => {
    const { result } = renderHook(() =>
      useBound({ dataSource: { object: 'account' } }, { object: 'api' }, makeAdapter()),
    );
    expect(result.current.schema.api).toBe('account');
    expect(result.current.schema.objectName).toBeUndefined();
  });

  it('maps nothing for `object: false` (the block reads the binding itself)', () => {
    const { result } = renderHook(() =>
      useBound({ dataSource: { object: 'account' } }, { object: false }, makeAdapter()),
    );
    expect(result.current.schema.objectName).toBeUndefined();
  });

  it('AND-combines the binding filter with the component filter', () => {
    const { result } = renderHook(() =>
      useBound(
        {
          filter: [['owner', '=', 'me']],
          dataSource: { object: 'account', filter: [['rating', '=', 'hot']] },
        },
        FULL,
        makeAdapter(),
      ),
    );
    // Two sources ⇒ one `and` node. The binding NARROWS the component's filter;
    // it can never widen it, which is the direction the spec's "additional
    // filter criteria" fixes.
    expect(JSON.stringify(result.current.schema.filter)).toContain('and');
    expect(JSON.stringify(result.current.schema.filter)).toContain('rating');
    expect(JSON.stringify(result.current.schema.filter)).toContain('owner');
  });
});

describe('useElementDataSourceSchema — binding with a saved view', () => {
  it('applies the view’s columns, filter, sort, row cap and kind', async () => {
    const result = await resolved({ type: 'list-view', dataSource: { object: 'account', view: 'hot' } }, FULL);
    expect(result.current.status).toBe('resolved');
    const bound = result.current.schema;
    expect(bound.objectName).toBe('account');
    expect(bound.columns).toEqual(['name', 'rating']);
    expect(bound.filter).toEqual([['rating', '=', 'hot']]);
    expect(bound.sort).toEqual([{ field: 'name', order: 'desc' }]);
    expect(bound.pagination).toEqual({ pageSize: 7 });
    expect(bound.viewType).toBe('kanban');
  });

  it('still resolves a view served under snake `list_views` (stored-data compatibility, #5362)', async () => {
    // `listViews` (camelCase) is the canonical spelling — @objectstack/spec
    // declares nothing else, and every fixture above uses it. This pin is the
    // OTHER half of that settlement: stored app data published before the
    // canonization has never been censused (objectstack#7917), so the snake
    // READ fallback in `useElementDataSource` must survive until that census
    // exists. If this test is failing because the fallback was removed, the
    // removal needs the census as evidence, not a cleanup rationale.
    const snakeAdapter = {
      find: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({ name: 'account', list_views: { hot: HOT_VIEW } }),
    };
    const result = await resolved(
      { type: 'list-view', dataSource: { object: 'account', view: 'hot' } },
      FULL,
      snakeAdapter,
    );
    expect(result.current.status).toBe('resolved');
    expect(result.current.schema.columns).toEqual(['name', 'rating']);
    expect(result.current.schema.filter).toEqual([['rating', '=', 'hot']]);
  });

  it('lets an authored key win over the same key from the view', async () => {
    const result = await resolved(
      {
        columns: ['id'],
        sort: [{ field: 'created', order: 'asc' }],
        pagination: { pageSize: 25 },
        viewType: 'grid',
        dataSource: { object: 'account', view: 'hot' },
      },
      FULL,
    );
    const bound = result.current.schema;
    // A `view` is a reference; a key written on the component itself is more
    // specific than the view it points at.
    expect(bound.columns).toEqual(['id']);
    expect(bound.sort).toEqual([{ field: 'created', order: 'asc' }]);
    expect(bound.pagination).toEqual({ pageSize: 25 });
    expect(bound.viewType).toBe('grid');
  });

  it('treats an authored EMPTY `columns` as not authored', async () => {
    // `[]` is what the designer emits for an unconfigured column list, and
    // supplying the columns is exactly why a view was named.
    const result = await resolved({ columns: [], dataSource: { object: 'account', view: 'hot' } }, FULL);
    expect(result.current.schema.columns).toEqual(['name', 'rating']);
  });

  it('lets an explicit BINDING key override the view (not just the component)', async () => {
    const result = await resolved(
      {
        sort: [{ field: 'created', order: 'asc' }],
        pagination: { pageSize: 25 },
        dataSource: { object: 'account', view: 'hot', sort: [{ field: 'amount', order: 'asc' }], limit: 3 },
      },
      FULL,
    );
    const bound = result.current.schema;
    expect(bound.sort).toEqual([{ field: 'amount', order: 'asc' }]);
    expect(bound.pagination).toEqual({ pageSize: 3 });
  });

  it('ANDs the view filter, the binding filter and the component filter', async () => {
    const result = await resolved(
      {
        filter: [['owner', '=', 'me']],
        dataSource: { object: 'account', view: 'hot', filter: [['amount', '>', 100]] },
      },
      FULL,
    );
    const json = JSON.stringify(result.current.schema.filter);
    expect(json).toContain('rating'); // the view's
    expect(json).toContain('amount'); // the binding's
    expect(json).toContain('owner'); // the component's
  });

  it('writes the row cap to the flat `limit` key when that is what the block reads', async () => {
    const result = await resolved(
      { dataSource: { object: 'account', view: 'hot' } },
      { limit: 'limit' },
    );
    expect(result.current.schema.limit).toBe(7);
    expect(result.current.schema.pagination).toBeUndefined();
  });
});

describe('useElementDataSourceSchema — an unmapped key is never written', () => {
  it('writes ONLY the object name for the default mapping', async () => {
    // `object-form`'s wiring: one record, no collection query, so the binding's
    // remaining keys have no read site. They must not be parked on the schema —
    // a key written where nothing reads it is the defect, not the fix.
    const result = await resolved(
      { type: 'object-form', dataSource: { object: 'account', view: 'hot', limit: 10, sort: [{ field: 'x', order: 'asc' }] } },
      {},
    );
    const bound = result.current.schema;
    expect(bound.objectName).toBe('account');
    expect(bound.columns).toBeUndefined();
    expect(bound.filter).toBeUndefined();
    expect(bound.sort).toBeUndefined();
    expect(bound.limit).toBeUndefined();
    expect(bound.pagination).toBeUndefined();
    expect(bound.viewType).toBeUndefined();
  });

  it('writes the filter but not the view’s columns for a filter-only mapping', async () => {
    // `object-kanban`'s wiring. Its `columns` are SWIMLANES, not fields: the
    // view's `['name','rating']` written there would render two empty lanes.
    const lanes = [{ id: 'open', title: 'Open' }];
    const result = await resolved(
      { type: 'object-kanban', columns: lanes, groupBy: 'status', dataSource: { object: 'account', view: 'hot' } },
      { filter: true },
    );
    const bound = result.current.schema;
    expect(bound.objectName).toBe('account');
    expect(bound.filter).toEqual([['rating', '=', 'hot']]);
    expect(bound.columns).toBe(lanes);
    expect(bound.sort).toBeUndefined();
  });
});

describe('ElementDataSourceGate — resolution states', () => {
  const Block = ({ schema }: { schema: any }) => (
    <div data-testid="block">{String(schema?.objectName)}</div>
  );

  it('renders the block once the view resolves', async () => {
    const { getByTestId } = render(
      <ElementDataSourceGate
        schema={{ dataSource: { object: 'account', view: 'hot' } }}
        mapping={FULL}
        dataSource={makeAdapter()}
        testId="probe"
      >
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    await waitFor(() => expect(getByTestId('block').textContent).toBe('account'));
  });

  it('reports an unresolvable `view` instead of rendering the block unfiltered', async () => {
    // The failure this whole binding exists to remove: falling back to the
    // object's default scope turns a typo into a WIDER answer on a page that
    // still looks like it works.
    const { getByTestId, queryByTestId } = render(
      <ElementDataSourceGate
        schema={{ dataSource: { object: 'account', view: 'nope' } }}
        mapping={FULL}
        dataSource={makeAdapter()}
        testId="probe"
      >
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    await waitFor(() => expect(queryByTestId('probe-datasource-error')).not.toBeNull());
    expect(queryByTestId('block')).toBeNull();
    // The known-view list is the part that actually gets an author unstuck.
    expect(getByTestId('probe-datasource-error').textContent).toContain('hot');
  });

  it('shows a placeholder — not the error — while the views are being fetched', () => {
    let release: (v: unknown) => void = () => {};
    const adapter = {
      getObjectSchema: vi.fn().mockReturnValue(new Promise((r) => { release = r; })),
    };
    const { queryByTestId } = render(
      <ElementDataSourceGate
        schema={{ dataSource: { object: 'account', view: 'hot' } }}
        mapping={FULL}
        dataSource={adapter}
        testId="probe"
      >
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    // "Not resolved yet" is not "does not exist" — conflating them would flash a
    // configuration error on every mount.
    expect(queryByTestId('probe-resolving-view')).not.toBeNull();
    expect(queryByTestId('probe-datasource-error')).toBeNull();
    release({ name: 'account', listViews: { hot: HOT_VIEW } });
  });

  it('renders the block untouched when there is no binding at all', () => {
    const { getByTestId } = render(
      <ElementDataSourceGate schema={{ objectName: 'task' }} mapping={FULL} testId="probe">
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    expect(getByTestId('block').textContent).toBe('task');
  });
});

describe('ElementDataSourceGate — no adapter resolved (objectui#5378 item 2)', () => {
  const Block = ({ schema }: { schema: any }) => (
    <div data-testid="block">{String(schema?.objectName)}</div>
  );

  const gate = (props: Record<string, unknown>) => (
    <ElementDataSourceGate
      schema={{ objectName: 'account' }}
      testId="probe"
      requiresDataSource
      noDataSourceMessage={noDataSourceMessage('probe-block', 'account')}
      {...props}
    >
      {(bound) => <Block schema={bound} />}
    </ElementDataSourceGate>
  );

  it('renders the panel instead of the block when no adapter resolves', () => {
    const { getByTestId, queryByTestId } = render(gate({}));
    const panel = getByTestId('probe-no-data-source');
    expect(panel).toHaveAttribute('role', 'alert');
    expect(queryByTestId('block')).toBeNull();
  });

  it('names the block, the object and the ancestor that injects the adapter', () => {
    // The message has to be an ADDRESS. "Nothing rendered" is what the author
    // already had; what they did not have is where to look.
    const { getByTestId } = render(gate({}));
    const text = getByTestId('probe-no-data-source').textContent ?? '';
    expect(text).toContain('probe-block');
    expect(text).toContain('account');
    expect(text).toContain('SchemaRendererProvider');
  });

  it('is satisfied by the provider context, not only by an explicit adapter', () => {
    const { getByTestId, queryByTestId } = render(
      <SchemaRendererProvider dataSource={makeAdapter() as any}>
        {gate({})}
      </SchemaRendererProvider>,
    );
    expect(queryByTestId('probe-no-data-source')).toBeNull();
    expect(getByTestId('block').textContent).toBe('account');
  });

  it('never fires when the call site did not opt in', () => {
    // Every other block that uses this gate is untouched: the check is opt-IN
    // because "needs an adapter" is a statement about the block's own
    // fallbacks, and a wrong guess paints a configuration error over a
    // component that is working.
    const { getByTestId, queryByTestId } = render(
      <ElementDataSourceGate schema={{ objectName: 'account' }} testId="probe">
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    expect(queryByTestId('probe-no-data-source')).toBeNull();
    expect(getByTestId('block').textContent).toBe('account');
  });

  it('answers "which data source?" before "which view?"', async () => {
    // With no adapter, the view cannot resolve EITHER — so the view panel would
    // fire too, reporting "this data source cannot list the saved views", which
    // is true and points at the view name instead of at the missing injection.
    const { findByTestId, queryByTestId } = render(
      <ElementDataSourceGate
        schema={{ objectName: 'account', dataSource: { object: 'account', view: 'hot' } }}
        testId="probe"
        requiresDataSource
        noDataSourceMessage={noDataSourceMessage('probe-block', 'account')}
      >
        {(bound) => <Block schema={bound} />}
      </ElementDataSourceGate>,
    );
    await findByTestId('probe-no-data-source');
    expect(queryByTestId('probe-datasource-error')).toBeNull();
  });
});

describe('useResolvedDataSource — one resolution rule for the family', () => {
  const read = (explicit: unknown, ambient?: unknown) => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      ambient === undefined
        ? <>{children}</>
        : <SchemaRendererProvider dataSource={ambient as any}>{children}</SchemaRendererProvider>;
    return renderHook(() => useResolvedDataSource(explicit), { wrapper }).result.current;
  };

  it('prefers the explicit adapter over the ambient one', () => {
    const explicit = makeAdapter();
    const ambient = makeAdapter();
    expect(read(explicit, ambient)).toBe(explicit);
  });

  it('falls back to the provider context', () => {
    const ambient = makeAdapter();
    expect(read(undefined, ambient)).toBe(ambient);
  });

  it('is undefined — not a throw — when there is no provider at all', () => {
    // `useSchemaContext()` throws here, which is how "this page never wired a
    // data source" used to surface as an error boundary over a React hook
    // message instead of as the panel above.
    expect(read(undefined)).toBeUndefined();
  });

  it('never mistakes the spec BINDING for an adapter', () => {
    // Same guard `useElementDataSourceSchema` applies: counting the binding as
    // an adapter is how "no data source" reads as "resolved".
    const ambient = makeAdapter();
    expect(read({ object: 'account', view: 'hot' }, ambient)).toBe(ambient);
  });
});
