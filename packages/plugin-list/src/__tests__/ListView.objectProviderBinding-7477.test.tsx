/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7477 — a react page binds ListView the way the published
 * `react-blocks` contract recommends, and it renders.
 *
 * Step 6 of #2890, released by the maintainer's ruling B on objectstack#14791.
 * The reported shape:
 *
 *     <ListView data={{ provider: 'object', object: 'x' }} type="kanban" />
 *
 * Both halves of that binding used to be INERT here, and silently so:
 *
 *   - `data.provider === 'object'` was read at ZERO sites in `ListView.tsx`
 *     (`provider === 'value'` and `provider === 'api'` are both live there, so
 *     the zero was a real gap and not a dead instrument). `schema.objectName`
 *     stayed undefined, `fetchData` returned early on `!schema.objectName`, and
 *     the page rendered an empty list with NO diagnostic — while the same
 *     metadata validates green against `@objectstack/spec`'s `ViewDataSchema`.
 *   - the author's `type` — which the react tier parks under `specType`,
 *     because the SDUI envelope claims the `type` key (ADR-0078,
 *     `components/renderers/layout/react-page.tsx`) — was read at ZERO sites in
 *     this package, so an absent `viewType` forced the view to `grid`.
 *
 * The fix is ONE fold in `normalizeListViewSchema` (`@object-ui/core`), not a
 * seventh per-block copy of the six sibling `data.object` reads and not a
 * renderer-side `??` dual-read (AGENTS.md #0.1).
 *
 * ## Why this file mounts the REAL react page tier
 *
 * The card's criterion is written about a react PAGE, and the `specType` park
 * only exists because that tier's wrapper puts it there. Asserting against a
 * hand-built `{ specType }` bag would pin this package's half against a shape
 * this file itself asserts — so the first test drives the real
 * `kind:'react'` compile, the real scope injection, the real `list-view`
 * registration and a spy under `object-kanban`, and the hand-built bag is kept
 * only as the narrower second case.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * drop either leg of the fold in `normalize-list-view.ts` and this file goes
 * red in a leg-specific way — without the `data.object` leg the kanban is
 * handed `objectName: undefined` and nothing is fetched; without the
 * `specType` leg the page renders `object-grid` instead of `object-kanban`.
 * The `provider: 'value'` case is the control that stays green either way.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider, AdapterCtx } from '@object-ui/react';
// Registers the page renderers (`type:'page'` / `'home'`), which dispatch
// `kind:'react'` to `ReactKindPage`.
import '@object-ui/components';
// Registers the REAL `list-view`, which is what the react page's scope resolves.
import '../index';
import { ListView } from '../ListView';

const OBJECT = 'crm_task';

const rows = [
  { id: 't-1', name: 'Draft the brief', stage: 'todo' },
  { id: 't-2', name: 'Ship the fold', stage: 'doing' },
];

const objectDef = {
  name: OBJECT,
  label: 'Task',
  fields: {
    id: { name: 'id', type: 'text', label: 'Id' },
    name: { name: 'name', type: 'text', label: 'Name' },
    stage: { name: 'stage', type: 'text', label: 'Stage' },
  },
};

/** Props each view spy last received. */
let kanbanProps: Array<Record<string, any>> = [];
let gridProps: Array<Record<string, any>> = [];

ComponentRegistry.register(
  'object-kanban',
  (props: Record<string, any>) => {
    kanbanProps.push(props);
    return <div data-testid="kanban-spy" />;
  },
  { namespace: 'test', label: 'Kanban spy', category: 'view' },
);

ComponentRegistry.register(
  'object-grid',
  (props: Record<string, any>) => {
    gridProps.push(props);
    return <div data-testid="grid-spy" />;
  },
  { namespace: 'test', label: 'Grid spy', category: 'view' },
);

const makeDataSource = () =>
  ({
    find: vi.fn(async () => rows),
    findOne: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(async () => rows.length),
    getObjectSchema: vi.fn(async () => objectDef),
    getObjects: vi.fn(async () => []),
    onMutation: () => () => {},
  }) as any;

/** Render a real `kind:'react'` page and return its live adapter. */
function renderReactPage(source: string) {
  const dataSource = makeDataSource();
  render(
    <AdapterCtx.Provider value={dataSource}>
      <SchemaRendererProvider dataSource={dataSource}>
        <SchemaRenderer
          schema={{ type: 'page', kind: 'react', name: 'binding_page', source } as never}
        />
      </SchemaRendererProvider>
    </AdapterCtx.Provider>,
  );
  return dataSource;
}

/** Mount ListView directly on an already-built schema bag. */
function renderListView(schema: Record<string, any>) {
  const dataSource = makeDataSource();
  render(
    <SchemaRendererProvider dataSource={dataSource}>
      <ListView schema={{ type: 'list-view', ...schema } as never} dataSource={dataSource} />
    </SchemaRendererProvider>,
  );
  return dataSource;
}

beforeEach(() => {
  kanbanProps = [];
  gridProps = [];
});
afterEach(cleanup);

describe("ListView — data={{ provider: 'object', object }} binds the view (objectui#7477)", () => {
  it("renders object `x` as a KANBAN from a react page that declares neither objectName nor viewType", async () => {
    // THE EXECUTABLE CRITERION, verbatim in substance from the card. Before the
    // fold this rendered `object-grid` with `objectName: undefined` and never
    // called `find` — an empty list, no diagnostic.
    const dataSource = renderReactPage(`
function Page() {
  return <ListView data={{ provider: 'object', object: '${OBJECT}' }} type="kanban" />;
}`);

    await waitFor(() => expect(kanbanProps.length).toBeGreaterThan(0));
    // (a) the KIND came from the author's `type`, parked under `specType`.
    expect(gridProps).toHaveLength(0);
    // (b) the OBJECT came from the `object` provider's `object`.
    expect(kanbanProps[kanbanProps.length - 1].schema.objectName).toBe(OBJECT);
    // (c) and it is a live binding, not just a prop: the view queried object x.
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());
    expect(dataSource.find.mock.calls[0][0]).toBe(OBJECT);
  });

  it('binds the same way when the wrapper-built bag is handed straight to the block', async () => {
    // The narrower half of the case above: exactly the bag
    // `buildComponentScope`'s wrapper produces (react-page.tsx — the
    // discriminator wins `type`, the author's value is parked beside it), with
    // the page tier taken out of the picture.
    const dataSource = renderListView({
      data: { provider: 'object', object: OBJECT },
      specType: 'kanban',
    });

    await waitFor(() => expect(kanbanProps.length).toBeGreaterThan(0));
    expect(kanbanProps[kanbanProps.length - 1].schema.objectName).toBe(OBJECT);
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());
    expect(dataSource.find.mock.calls[0][0]).toBe(OBJECT);
  });

  it('binds the object even when the author states no kind at all (still a grid)', async () => {
    // The `object` provider leg alone. `viewType` absent and no author `type`
    // ⇒ the pre-existing `'grid'` default still applies, unchanged.
    const dataSource = renderListView({ data: { provider: 'object', object: OBJECT } });

    await waitFor(() => expect(gridProps.length).toBeGreaterThan(0));
    expect(kanbanProps).toHaveLength(0);
    expect(gridProps[gridProps.length - 1].schema.objectName).toBe(OBJECT);
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());
    expect(dataSource.find.mock.calls[0][0]).toBe(OBJECT);
  });

  it('invents NO binding from an `object` provider that names no object', async () => {
    // The negative control that keeps the three cases above from passing
    // vacuously: a half-written data block must not manufacture an objectName,
    // and must not start a query.
    const dataSource = renderListView({ data: { provider: 'object' }, specType: 'kanban' });

    await waitFor(() => expect(kanbanProps.length).toBeGreaterThan(0));
    expect(kanbanProps[kanbanProps.length - 1].schema.objectName).toBeUndefined();
    expect(dataSource.find).not.toHaveBeenCalled();
  });

  it("leaves the `value` provider alone — it never gains an objectName", async () => {
    // The live sibling provider, as the control this fold must not disturb:
    // inline rows still render with no object binding and no query.
    const dataSource = renderListView({
      data: { provider: 'value', items: rows },
      specType: 'kanban',
    });

    await waitFor(() => expect(kanbanProps.length).toBeGreaterThan(0));
    expect(kanbanProps[kanbanProps.length - 1].schema.objectName).toBeUndefined();
    expect(dataSource.find).not.toHaveBeenCalled();
  });

  it('lets an explicit `viewType` win over the author-parked `specType`', async () => {
    // Gap-fill only. The `specType` leg fills the kind that used to resolve to
    // `'grid'`; it never overrides a kind the view already states.
    renderListView({
      data: { provider: 'object', object: OBJECT },
      viewType: 'grid',
      specType: 'kanban',
    });

    await waitFor(() => expect(gridProps.length).toBeGreaterThan(0));
    expect(kanbanProps).toHaveLength(0);
  });

  it('lets an explicit `objectName` win over the data block', async () => {
    // The other half of gap-fill: this fold can never re-point a binding that
    // already resolves.
    const dataSource = renderListView({
      objectName: OBJECT,
      data: { provider: 'object', object: 'crm_other' },
      specType: 'kanban',
    });

    await waitFor(() => expect(kanbanProps.length).toBeGreaterThan(0));
    expect(kanbanProps[kanbanProps.length - 1].schema.objectName).toBe(OBJECT);
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());
    expect(dataSource.find.mock.calls[0][0]).toBe(OBJECT);
  });
});
