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
 * Module-scope import of the barrel, not `beforeAll` (AGENTS.md §测试纪律): the
 * registration is a load-time side effect of `../index`, and its transform cost
 * belongs to the import phase rather than a hook's 10s budget.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { registerLayout, type NavigationRendererProps } from '../index';

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
