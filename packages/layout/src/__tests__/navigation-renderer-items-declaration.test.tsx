/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `navigation-renderer` declares `items` as the ARRAY it is (objectui#3972).
 *
 * The registration used to say `{ name: 'items', type: 'object' }` while
 * `NavigationRendererProps.items` is `NavigationItem[]`. In `sdui-parser` those
 * two are mutually exclusive checks, not loose synonyms
 * (`src/validate.ts:124-129`):
 *
 *   'array'   -> Array.isArray(value)
 *   'object'  -> typeof value === 'object' && value !== null && !Array.isArray(value)
 *
 * So the manifest gate reported `type-mismatch: <navigation-renderer> prop
 * "items" expected an object` on the only value this renderer can render, and
 * said nothing about the object that would crash it. A gate that is wrong about
 * the correct shape is worse than no gate: it teaches authors — AI authors above
 * all, which is who reads a manifest — to write the shape the component cannot
 * consume, and to discount `type-mismatch` in general.
 *
 * Two halves are pinned here, and they fail for different reasons:
 *
 *  1. the DECLARATION says `array` (runtime, from the live registry);
 *  2. the PROP really is an array (compile-time, from the component's own type),
 *     so if `items` is ever reshaped, `pnpm type-check` fails here instead of the
 *     declaration silently drifting back out of alignment.
 *
 * The manifest-gate half — an array-valued `items` node drawing no
 * `type-mismatch`, with an object-valued one still drawing it — lives in
 * `examples/schema-catalog/test/pageheader-with-actions.test.tsx`, next to the
 * `diagnose()` helper that builds the manifest the app really validates against.
 *
 * objectui#3987 added the fourth face of the same key — `required: true`, plus
 * the render crash that makes it a crash-stopper rather than documentation — in
 * the two describes at the bottom of this file, and its manifest-gate half sits
 * beside #3972's in that same schema-catalog file.
 *
 * Module-scope import of the barrel, not `beforeAll` (AGENTS.md §测试纪律): the
 * registration is a load-time side effect of `../index`, and its transform cost
 * belongs to the import phase rather than a hook's 10s budget.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';
import { registerLayout, NavigationRenderer, type NavigationRendererProps } from '../index';

registerLayout();

/**
 * Compile-time half of the pin. `NavigationRendererProps['items']` must remain
 * assignable to an array; when it is not, this constant stops type-checking and
 * the message points at the declaration that has to move with it.
 */
type ItemsAreAnArray = NavigationRendererProps['items'] extends readonly unknown[] ? true : false;
const ITEMS_ARE_AN_ARRAY: ItemsAreAnArray = true;

describe('the `navigation-renderer` registration declares `items` as an array (objectui#3972)', () => {
  it.each([undefined, 'layout'])('declares `type: array` (namespace: %s)', (namespace) => {
    const config = ComponentRegistry.getConfig('navigation-renderer', namespace);
    expect(config, 'navigation-renderer is not registered').toBeTruthy();

    const items = (config?.inputs ?? []).find((input) => input.name === 'items');
    expect(items, 'navigation-renderer no longer declares `items` at all').toBeTruthy();
    expect(items?.type).toBe('array');
  });

  it('and the prop it describes is still an array', () => {
    // Asserted rather than merely declared above so the compile-time half is
    // visible in the run output too — a `const` nobody reads is easy to delete.
    expect(ITEMS_ARE_AN_ARRAY).toBe(true);
  });
});

/**
 * The FOURTH face of the same agreement: `items` is declared REQUIRED
 * (objectui#3987).
 *
 * #3972 above aligned the key's existence and its type. Optionality is a
 * separate fact and it was declared the opposite of what the component
 * enforces: `NavigationRendererProps.items` has no `?`, the renderer supplies
 * no default, and `sdui-parser` reports `missing-required-prop` only when
 * `input.required` is set (`validate.ts:55-64`). So a bare
 * `{ "type": "navigation-renderer" }` node passed validation in complete
 * silence and then threw on render — the crash is witnessed by the describe
 * below, not inferred.
 *
 * `basePath` is the control, and a real one rather than a nonsense key: the
 * renderer genuinely defaults it (`basePath = ''`), so it must stay optional.
 * "Everything is required" would be as wrong as "nothing is" — the flag is a
 * per-prop fact about whether the component can proceed without it.
 */
type ItemsIsRequiredProp = undefined extends NavigationRendererProps['items'] ? false : true;
const ITEMS_IS_REQUIRED_PROP: ItemsIsRequiredProp = true;

describe('the `navigation-renderer` registration declares `items` required (objectui#3987)', () => {
  it.each([undefined, 'layout'])('declares `required: true` (namespace: %s)', (namespace) => {
    const config = ComponentRegistry.getConfig('navigation-renderer', namespace);
    expect(config, 'navigation-renderer is not registered').toBeTruthy();

    const items = (config?.inputs ?? []).find((input) => input.name === 'items');
    expect(items, 'navigation-renderer no longer declares `items` at all').toBeTruthy();
    expect(items?.required).toBe(true);
  });

  it.each([undefined, 'layout'])(
    'leaves `basePath` optional — the renderer defaults it (namespace: %s)',
    (namespace) => {
      const config = ComponentRegistry.getConfig('navigation-renderer', namespace);
      const basePath = (config?.inputs ?? []).find((input) => input.name === 'basePath');
      expect(basePath, 'navigation-renderer no longer declares `basePath` at all').toBeTruthy();
      // Not `toBe(false)`: the declaration omits the flag entirely, and
      // `validate.ts` reads it as a truthiness test. What must never happen is
      // this control turning truthy, which would mean the `required` assertion
      // above is measuring a blanket rather than a per-prop decision.
      expect(basePath?.required).toBeFalsy();
    },
  );

  it('and the prop it describes is still non-optional in TS', () => {
    // Compile-time half: if `items` ever becomes `items?: NavigationItem[]`,
    // `ItemsIsRequiredProp` resolves to `false` and this file stops
    // type-checking — the declaration cannot silently drift back.
    expect(ITEMS_IS_REQUIRED_PROP).toBe(true);
  });
});

/**
 * Why the declaration above is a crash-stopper and not documentation
 * (objectui#3987).
 *
 * objectui#3987 read the crash statically (no default + unguarded
 * dereferences). This is the measured version, and it corrects the reading in
 * one place: the FIRST unguarded read is `collectPinnedItems(filteredItems)` in
 * the `pinnedItems` memo (`NavigationRenderer.tsx:1242` → `:1410`), which does
 * `for (const item of items)`. The `resolveActiveNavItem` memo above it survives
 * an absent list (its `visit` starts with `if (!nodes) return`), and
 * `filteredItems.slice()` at `:1247` would throw too but is never reached.
 *
 * If the alternative route in objectui#3987 is ever taken — giving `items` a
 * `= []` default so a node without it renders an empty navigation — REPLACE this
 * describe with the empty-render assertion instead of deleting it, and keep
 * `required: true`: an author who forgot `items` wants a diagnostic, and a
 * silently empty sidebar is not one.
 */
describe('a `navigation-renderer` authored without `items` crashes on render (objectui#3987)', () => {
  const renderNav = (props: Partial<NavigationRendererProps>) =>
    render(
      <MemoryRouter initialEntries={['/apps/crm']}>
        <SidebarProvider defaultOpen>
          <NavigationRenderer {...(props as NavigationRendererProps)} />
        </SidebarProvider>
      </MemoryRouter>,
    );

  it('throws a TypeError instead of rendering an empty navigation', () => {
    // React logs the render error on its own; the assertion is about the throw,
    // so keep the captured output clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // `basePath` is supplied so the ONLY missing prop is the required one.
      expect(() => renderNav({ basePath: '/apps/crm' })).toThrow(TypeError);
      // The wording is V8's for `for…of` over `undefined`; the load-bearing part
      // is the throw, but pinning the text catches a swap to some other failure
      // mode that would need this whole describe re-read.
      expect(() => renderNav({ basePath: '/apps/crm' })).toThrow(/items is not iterable/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('renders fine when `items` is supplied and the optional `basePath` is not', () => {
    // The other half of the control pair: the props the declaration calls
    // optional really are optional, so the throw above is about `items` and not
    // about rendering this component bare in a test.
    expect(() =>
      renderNav({ items: [{ id: 'nav_accounts', type: 'object', label: 'Accounts', objectName: 'account' }] }),
    ).not.toThrow();
    expect(screen.getByText('Accounts')).toBeTruthy();
  });
});
