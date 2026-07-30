/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Contract guard for the `kind:'react'` page tier (ADR-0080).
 *
 * A react page's `source` is a STRING compiled at runtime, so nothing inside it
 * is statically analysable. The public data blocks (`<ListView>`,
 * `<ObjectForm>`, …) are injected into the evaluated scope by
 * `buildComponentScope` (renderers/layout/react-page.tsx) rather than imported
 * by the authoring file — which is exactly why this tier keeps being mis-read
 * as broken, and why a regression here would be invisible: drop a tag from
 * PUBLIC_BLOCKS or flip it to `isContainer` and it silently vanishes from every
 * react page's scope while type-check, lint and build all stay green.
 *
 * These tests pin the four halves of that contract:
 *   1. `list-view` / `object-form` stay eligible for injection;
 *   2. an author writes `<ListView …/>` with FLAT props and no import, and the
 *      wrapper folds them into the block's `schema`;
 *   3. a block that is only *lazily* registered is in the scope too — the
 *      contract may not depend on which plugin chunks happen to be loaded
 *      (objectui#2953);
 *   4. an identifier that is genuinely absent fails LOUDLY — the negative
 *      control that keeps (2) and (3) from passing vacuously.
 *
 * Registered stand-ins are used instead of the real plugin-list / plugin-form:
 * `packages/components` sits BELOW the plugins in the dependency graph, and the
 * unit under test is the scope builder, not the blocks themselves.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, AdapterCtx } from '@object-ui/react';

/** Props the stand-in blocks last received, for flat-prop assertions. */
const captured: { listView?: any; objectForm?: any; kanban?: any } = {};

const adapter = { find: async () => [], getObjectSchema: async () => ({ name: 'showcase_project', fields: {} }) } as any;

function renderReactPage(source: string) {
  return render(
    <AdapterCtx.Provider value={adapter}>
      <SchemaRenderer schema={{ type: 'home', kind: 'react', name: 'test_page', source }} />
    </AdapterCtx.Provider>,
  );
}

beforeAll(async () => {
  // Registers PageRenderer for `type:'home'`, which dispatches kind:'react'.
  await import('../renderers');

  // Stand-ins under the REAL curated tags. `getPublicConfigs()` walks
  // PUBLIC_BLOCKS and resolves each tag, so registering the bare tag is enough
  // to make it public — no `tier` flag needed. Neither tag is registered by
  // @object-ui/components, so nothing is being clobbered.
  ComponentRegistry.register('list-view', (props: any) => {
    captured.listView = props;
    return <div data-testid="list-view-double" />;
  });
  ComponentRegistry.register('object-form', (props: any) => {
    captured.objectForm = props;
    return <div data-testid="object-form-double" />;
  });
}, 30000);

afterAll(() => {
  ComponentRegistry.unregister('list-view');
  ComponentRegistry.unregister('object-form');
});

beforeEach(() => {
  captured.listView = undefined;
  captured.objectForm = undefined;
  captured.kanban = undefined;
});

// ---------------------------------------------------------------------------
// 1. Eligibility — the silent kill switch
// ---------------------------------------------------------------------------

describe('kind:\'react\' scope eligibility', () => {
  it.each(['list-view', 'object-form'])(
    '`%s` is in the public contract and is not a container, so it is injected',
    (tag) => {
      const cfg = ComponentRegistry.getPublicConfigs().find((c: any) => c.type === tag);
      // Missing from PUBLIC_BLOCKS, or marked isContainer, => dropped from the
      // scope of every kind:'react' page (react-page.tsx:64-66).
      expect(cfg).toBeTruthy();
      expect((cfg as any).isContainer).toBeFalsy();
    },
  );
});

// ---------------------------------------------------------------------------
// 2. The contract authors rely on — no imports, flat props
// ---------------------------------------------------------------------------

describe('kind:\'react\' page source', () => {
  it('resolves <ListView> and <ObjectForm> without the page importing them', async () => {
    const source = `
function Page() {
  return (
    <div>
      <ListView objectName="showcase_project" fields={['name', 'status']} navigation={{ mode: 'none' }} onRowClick={() => {}} />
      <ObjectForm objectName="showcase_project" mode="edit" recordId="1" />
    </div>
  );
}`;
    const { findByTestId, queryByText } = renderReactPage(source);

    expect(await findByTestId('list-view-double')).toBeTruthy();
    expect(await findByTestId('object-form-double')).toBeTruthy();
    // The failure mode this guards: `ReferenceError: ListView is not defined`
    // surfaced through ReactRunner's fallback (react-page.tsx:186-191).
    expect(queryByText('React page error')).toBeNull();
  });

  it('folds flat props into the block schema and preserves function props', async () => {
    const source = `
function Page() {
  return <ListView objectName="showcase_project" fields={['name', 'status']} navigation={{ mode: 'none' }} onRowClick={() => {}} />;
}`;
    const { findByTestId } = renderReactPage(source);
    await findByTestId('list-view-double');

    // Flat JSX props are folded into the schema bag, and the discriminator wins
    // the `type` slot (react-page.tsx:79-84).
    expect(captured.listView.schema).toMatchObject({
      type: 'list-view',
      objectName: 'showcase_project',
      fields: ['name', 'status'],
      navigation: { mode: 'none' },
    });
    // Callbacks must survive as real props — the master/detail pattern in
    // apps/console/src/sdui-workbench-preview.tsx is built on onRowClick.
    expect(typeof captured.listView.onRowClick).toBe('function');
    // The wrapper stamps the live adapter in, since list-view reads dataSource
    // from props rather than from context (react-page.tsx:61-63).
    expect(captured.listView.schema.dataSource).toBe(adapter);
  });

  it('injects useAdapter so a page can query on its own', async () => {
    const source = `
function Page() {
  const a = useAdapter();
  return <div data-testid="adapter-probe">{a ? 'has-adapter' : 'no-adapter'}</div>;
}`;
    const { findByTestId } = renderReactPage(source);
    expect((await findByTestId('adapter-probe')).textContent).toBe('has-adapter');
  });
});

// ---------------------------------------------------------------------------
// 3. Lazily-registered blocks are contract members too (objectui#2953)
// ---------------------------------------------------------------------------

describe('kind:\'react\' scope — lazily-registered blocks', () => {
  it('injects a curated block that is only registered lazily', async () => {
    // How apps/console registers the heavy view plugins: a stub at boot, the
    // chunk imported on first use. Six PUBLIC_BLOCKS tags live this way
    // (object-kanban / -calendar / -gantt / -timeline / -map / markdown), and
    // all six used to be missing from every react page's scope, because
    // getPublicConfigs() resolved each curated tag through getConfig(), which
    // reads loaded registrations only.
    ComponentRegistry.registerLazy(
      'object-kanban',
      async () => {
        ComponentRegistry.register(
          'object-kanban',
          (props: any) => {
            captured.kanban = props;
            return <div data-testid="kanban-double" />;
          },
          { namespace: 'plugin-kanban' },
        );
      },
      { namespace: 'plugin-kanban', category: 'view' },
    );

    try {
      // The tag IS in the contract before its chunk has been imported …
      const cfg = ComponentRegistry.getPublicConfigs().find((c: any) => c.type === 'object-kanban');
      expect(cfg).toBeTruthy();
      expect((cfg as any).lazy).toBe(true);

      // … so `<ObjectKanban>` resolves in the page source instead of throwing
      // `ReferenceError: ObjectKanban is not defined`. The injected wrapper
      // defers to SchemaRenderer, which fires the loader, shows the "Loading…"
      // placeholder, and re-renders once the plugin registers for real.
      const source = `
function Page() {
  return <ObjectKanban objectName="showcase_project" groupBy="status" />;
}`;
      const { findByTestId, queryByText } = renderReactPage(source);

      expect(await findByTestId('kanban-double')).toBeTruthy();
      expect(queryByText('React page error')).toBeNull();
      expect(captured.kanban.schema).toMatchObject({ type: 'object-kanban', groupBy: 'status' });
    } finally {
      ComponentRegistry.unregister('object-kanban', 'plugin-kanban');
      ComponentRegistry.unregister('object-kanban');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Negative control — absence must be loud
// ---------------------------------------------------------------------------

describe('kind:\'react\' unknown identifier', () => {
  it('surfaces the ReferenceError in the page-level error panel', async () => {
    const source = `
function Page() {
  return <TotallyNotARegisteredBlock />;
}`;
    const { container, findByText } = renderReactPage(source);

    // Proves the assertions above are meaningful: when a block really is absent
    // from scope, the author sees this.
    //
    // The panel is ReactRunner's own `fallback` (react-page.tsx:186-191).
    // Pinning it also pins objectui#2954: `getDerivedStateFromProps` used to
    // re-transpile on every render and reset `error: null`, so the recovery
    // render rebuilt the same throwing element and the error escaped PAST this
    // fallback to SchemaRenderer's boundary ("Component "home" failed to
    // render") — the styled, page-specific panel was unreachable.
    expect(await findByText('React page error')).toBeTruthy();
    await waitFor(() =>
      expect(container.textContent).toContain('TotallyNotARegisteredBlock is not defined'),
    );
  });
});
