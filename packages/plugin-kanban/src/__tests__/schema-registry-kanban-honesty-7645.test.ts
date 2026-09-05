/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The renderer's own face satisfies what `SchemaRegistry['kanban']` asserts.
 *
 * ## Why this pin lives here and can live nowhere else
 *
 * objectui#7645: `@object-ui/types`' `SchemaRegistry` advertises itself as the
 * Single Source of Truth for component type lookups, and its `'kanban'` entry
 * named the DECLARATIVE authoring face while the renderer registered for that
 * key — `ObjectKanbanRenderer`, `ComponentRegistry.register('kanban', …)` in
 * `../index` — consumes {@link KanbanSchema} from this package. The two are
 * unrelated dialects (objectui#6172 ruled this package KEEPS the bare names).
 *
 * The entry was therefore weakened to the claim that layer can prove and both
 * dialects satisfy: a schema node tagged `'kanban'`. That claim is only worth
 * anything if it is actually TRUE of the renderer's face — and `@object-ui/types`
 * cannot check that: it cannot name this package (the import is a phantom
 * dependency; declaring it would close the cycle `@object-ui/types` →
 * `@object-ui/plugin-kanban` → `@object-ui/types`). This package depends on
 * `@object-ui/types`, so it is the only place in the workspace that can see both
 * sides at once — which is why this file exists, not one more pin by the map.
 *
 * ⛔ This file does not touch {@link KanbanSchema} — it only reads it. It is the
 * face objectui#6172 kept, and the one objectui#7664's ruling (a) (2026-09-05)
 * makes the declared shape; `KanbanSchema.data` stays a raw-row input, since
 * objectui#7651 was ruled B and closed as not_planned (2026-09-05T02:09:54Z).
 *
 * ## The instrument
 *
 * Compile-time only. Vitest strips types without checking them, so a green run
 * of this file proves nothing on its own; the assertions are read by
 * `tsc -p packages/plugin-kanban/tsconfig.test.json`, chained off this
 * package's `type-check` script. That project sets `"paths": {}`, so
 * `@object-ui/types` resolves through the workspace dependency to
 * `packages/types/dist/index.d.ts` — BUILD `@object-ui/types` before believing
 * either colour this file reports.
 */

import { describe, it, expect } from 'vitest';
import type { SchemaRegistry, DeclarativeKanbanSchema } from '@object-ui/types';
import type { KanbanSchema } from '../types';

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

describe("the registered kanban renderer's schema satisfies the registry entry", () => {
  it('is pinned at compile time', () => {
    // Non-vacuity controls: `any` on either side would satisfy every `extends`
    // below while checking nothing.
    type _PluginFaceIsReal = Assert<Equal<IsAny<KanbanSchema>, false>>;
    type _RegistryIsReal = Assert<Equal<IsAny<SchemaRegistry>, false>>;

    // 1. The claim the map now makes for `'kanban'` is TRUE of the face the
    //    registered renderer actually consumes. This is the assertion that
    //    makes the weakened entry honest rather than merely vaguer.
    type _PluginFaceSatisfiesTheEntry = Assert<
      KanbanSchema extends SchemaRegistry['kanban'] ? true : false
    >;

    // 2. …and, at this commit, still two dialects. objectui#7664's ruling (a)
    //    (2026-09-05) schedules their convergence; when it lands, the weakened
    //    entry has outlived its reason and this pin retires with the re-point.
    type _StillTwoDialects = Assert<
      Equal<Equal<KanbanSchema, DeclarativeKanbanSchema>, false>
    >;

    // 3. Both faces agree on the one thing the map asserts: the tag.
    type _PluginFaceIsTagged = Assert<Equal<KanbanSchema['type'], 'kanban'>>;

    expect(true).toBe(true);
  });
});
