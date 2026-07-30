/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Console ↔ public contract coverage (ADR-0080, objectui#2953).
 *
 * `PUBLIC_BLOCKS` is the curated contract and AI-authoring vocabulary. What an
 * author (or a model) can actually write is the intersection of that list with
 * what THIS APP registers — and nothing was checking the two against each
 * other. objectui#2953 is what that costs: `getPublicConfigs()` resolved each
 * curated tag through `getConfig()`, which reads loaded registrations only, so
 * every block the console registers via `registerLazy()` fell out of the
 * contract — and out of every `kind:'react'` page's scope — while type-check,
 * lint, build and the whole test suite stayed green.
 *
 * This reads the REAL registration list (`src/register-plugins.ts`, the same
 * module `main.tsx` boots from). A hand-copied list here would reproduce the
 * original failure: it would agree with itself and tell us nothing.
 *
 * The assertions are exact lists rather than "contains", because the failure
 * mode is a SHRINKING contract. `toContain` would sail past a block that
 * silently disappeared; an exact list makes both directions a deliberate edit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry, PUBLIC_BLOCKS, type PublicComponentConfig } from '@object-ui/core';

/**
 * Every curated tag the console makes available, in `PUBLIC_BLOCKS` order.
 * Update this only alongside a deliberate change to what the console ships.
 */
const EXPECTED_COVERED = [
  'object-grid',
  'list-view',
  'object-form',
  'embeddable-form',
  'object-master-detail-form',
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
  'object-metric',
  'object-chart',
  'dashboard',
  'object-pivot',
  'record:details',
  'record:highlights',
  'record:related_list',
  'record:path',
  'record:line_items',
  'flex',
  'grid',
  'stack',
  'card',
  'tabs',
  'accordion',
  'container',
  'page:header',
  'text',
  'image',
  'icon',
  'markdown',
  'element:divider',
  'badge',
  'alert',
  'button',
  'html',
];

/**
 * Curated tags with no renderer behind them yet — currently none.
 *
 * `PUBLIC_BLOCKS` is documented as aspirational-safe (an unregistered tag is
 * skipped), so a gap is allowed, but it has to be a listed, reviewable gap
 * rather than a silent one: "advertised in the contract, absent at runtime" is
 * exactly what an AI-authored page trips over.
 *
 * The one entry that used to sit here, `line_items`, was not aspirational at
 * all — it was a misspelling of `record:line_items`, whose renderer has shipped
 * in @object-ui/plugin-form all along. Keeping the list empty is what surfaces
 * the next one of those.
 */
const EXPECTED_UNIMPLEMENTED: string[] = [];

/**
 * The curated tags that reach the contract through a PENDING lazy stub in this
 * environment — i.e. the exact code path objectui#2953 broke. Nothing here is
 * eagerly imported by `register-plugins.ts` or by `vitest.setup.dom.tsx`.
 *
 * `dashboard` / `object-metric` / `object-pivot` are lazy in the real console
 * too, but the shared DOM setup imports `@object-ui/plugin-dashboard` eagerly,
 * so they arrive loaded here. That skew is precisely why the coverage
 * assertion above pins AVAILABILITY and not tier: whether a given block is
 * eager or lazy is a bundling decision that varies by host, while "the author
 * can write this tag" must not. If the shared setup ever imports one of the
 * plugins below, move that tag out of this list — it is still covered.
 */
const EXPECTED_LAZY = [
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
  'object-chart',
  'markdown',
];

let contract: Map<string, PublicComponentConfig>;

beforeAll(async () => {
  // The layout/content primitives (Tier B) …
  await import('@object-ui/components');
  // … and the console's own plugin layer, from the module main.tsx boots from.
  await import('../register-plugins');
  contract = new Map(ComponentRegistry.getPublicConfigs().map((c) => [c.type, c]));
}, 60000);

describe('console ↔ PUBLIC_BLOCKS coverage', () => {
  it('exposes every curated block the console ships, eager or lazy', () => {
    expect(PUBLIC_BLOCKS.filter((tag) => contract.has(tag))).toEqual(EXPECTED_COVERED);
  });

  it('leaves exactly the known-unimplemented curated tags uncovered', () => {
    expect(PUBLIC_BLOCKS.filter((tag) => !contract.has(tag))).toEqual(EXPECTED_UNIMPLEMENTED);
  });

  it('reaches the lazily-registered blocks before their chunks load (objectui#2953)', () => {
    // If `getPublicConfigs()` ever goes back to resolving through `getConfig()`,
    // these seven vanish from the contract — silently, since the plugin chunk
    // that would prove them present is exactly the thing that hasn't loaded.
    const lazy = EXPECTED_COVERED.filter((tag) => contract.get(tag)!.lazy);
    expect(lazy).toEqual(EXPECTED_LAZY);
    // A pending stub carries metadata but no renderer — consumers must go
    // through SchemaRenderer, which triggers the loader.
    for (const tag of EXPECTED_LAZY) {
      expect(contract.get(tag)!.component).toBeUndefined();
    }
  });

  it('keeps the contract keyed by the bare tag authors write', () => {
    for (const tag of EXPECTED_COVERED) {
      expect(contract.get(tag)!.type).toBe(tag);
    }
  });
});
