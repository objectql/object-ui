/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The bare `text` key belongs to `ui:text`, and ONE FLAG is why (objectui#7450).
 *
 * ## The hazard, measured
 *
 * Two production registrations claim the short name `text`:
 *
 *   `renderers/basic/text.tsx`     register('text', …, { namespace: 'ui' })
 *   `renderers/basic/elements.tsx` register('text', …, { namespace: 'element',
 *                                                        skipFallback: true })
 *
 * `Registry.register()` claims the bare key for a namespaced registration
 * `if (meta?.namespace && !meta?.skipFallback)`, and its own comment says "the
 * last registration wins for non-namespaced lookups". `renderers/basic/index.ts`
 * imports `./text` BEFORE `./elements`, so `element:text` is the LATER
 * registration and load order alone would hand it the bare key.
 * `skipFallback: true` is the single line that stops it.
 *
 * Deleting that one line is silent in every layer that would normally catch it:
 * `Registry.ts` only `console.warn`s on such an overwrite, no type changes, and
 * the corpus authors the bare `text` spelling (not `ui:text`), so every
 * `variant: 'h1'`…`'h6'` / `'overline'` node in it would start rendering through
 * the FOUR-value `element:text` renderer — which has no entry for those values
 * and falls through to a `<p>`. A heading that stops being a heading, with no
 * diagnostic anywhere.
 *
 * Nothing pinned that resolution before this file.
 *
 * ## Every fact here is DERIVED, and the mechanism has a live control
 *
 * The load-order half is read out of `renderers/basic/index.ts` at run time
 * rather than restated, so re-ordering those imports moves this pin with it.
 *
 * The mechanism half runs on a FRESH `Registry` instance, never the shared
 * singleton: two registrations in the same order as production, once with the
 * flag and once without. Without a control, "the bare key is `ui:text`" also
 * passes if the fallback path stopped working altogether, or if `element:text`
 * had quietly stopped registering — both of which would leave the assertion
 * green while the thing it describes was gone.
 */
import path from 'node:path';
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ComponentRegistry, Registry } from '@object-ui/core';
import { renderComponent } from './test-utils';
// Module scope, not a hook: the cold transform is billed to the import phase,
// which has no test/hook timeout (AGENTS.md, objectui#3010).
import '../renderers';

const BASIC_INDEX = fs.readFileSync(
  path.resolve(import.meta.dirname, '../renderers/basic/index.ts'),
  'utf8',
);

describe('objectui#7450 — the bare `text` key resolves to `ui:text`', () => {
  it('both claimants are registered (reachability before any identity claim)', () => {
    // Without this, every assertion below is satisfiable by a registration that
    // simply is not there any more.
    expect(ComponentRegistry.getConfig('ui:text'), 'ui:text is not registered').toBeDefined();
    expect(
      ComponentRegistry.getConfig('element:text'),
      'element:text is not registered',
    ).toBeDefined();
  });

  it('`text` resolves to `ui:text`, by component identity and not only by name', () => {
    const bare = ComponentRegistry.getConfig('text');
    const ui = ComponentRegistry.getConfig('ui:text');
    const element = ComponentRegistry.getConfig('element:text');

    expect(bare?.type).toBe('ui:text');
    expect(bare?.component).toBe(ui?.component);
    expect(bare?.component).not.toBe(element?.component);
  });

  it('load order alone would hand the bare key to `element:text`', () => {
    // Derived from the barrel, not restated: `./text` registers `ui:text` and
    // `./elements` registers `element:text`, so the LATER import is the later
    // registration.
    const uiAt = BASIC_INDEX.indexOf("import './text';");
    const elementAt = BASIC_INDEX.indexOf("import './elements';");

    expect(uiAt, "renderers/basic/index.ts no longer imports './text'").toBeGreaterThan(-1);
    expect(
      elementAt,
      "renderers/basic/index.ts no longer imports './elements'",
    ).toBeGreaterThan(-1);
    expect(elementAt).toBeGreaterThan(uiAt);
  });

  it('`skipFallback: true` on `element:text` is what overrides that order', () => {
    expect((ComponentRegistry.getConfig('element:text') as { skipFallback?: boolean })
      ?.skipFallback).toBe(true);
    expect((ComponentRegistry.getConfig('ui:text') as { skipFallback?: boolean })
      ?.skipFallback).toBeFalsy();
  });

  it('LIVE CONTROL — the same pair without the flag hands the bare key over', () => {
    // A fresh registry, so nothing here touches the shared singleton the rest of
    // the suite reads. Production order: the `ui` namespace first, `element`
    // second.
    const First = () => null;
    const Second = () => null;

    const guarded = new Registry<unknown>();
    guarded.register('text', First, { namespace: 'ui' });
    guarded.register('text', Second, { namespace: 'element', skipFallback: true });
    expect(guarded.getConfig('text')?.type).toBe('ui:text');

    const unguarded = new Registry<unknown>();
    unguarded.register('text', First, { namespace: 'ui' });
    unguarded.register('text', Second, { namespace: 'element' });
    // THE CONTROL FIRES: drop the flag and the later registration takes the key.
    expect(unguarded.getConfig('text')?.type).toBe('element:text');
  });

  it('what the flag protects: an authored `text` node keeps its heading element', () => {
    // The corpus spells the bare name, so this is the shape the flag decides for
    // every authored text node. `ui:text` maps `h1` to an `<h1>`; `element:text`
    // has no `h1` in its four-value vocabulary and falls through to a `<p>`.
    const { container } = renderComponent({ type: 'text', variant: 'h1', content: 'Title' } as never);

    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('h1');
  });
});
