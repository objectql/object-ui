/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `SchemaRegistry['kanban']` — the key survives, the value stops asserting.
 *
 * ## What this pins, and why the key half is the load-bearing half
 *
 * `ComponentType = keyof SchemaRegistry` is a PUBLISHED union. The remedy for
 * objectui#7645 (this map's `'kanban'` value described the declarative
 * authoring face, not the type the registered renderer honours) had to leave
 * that union byte-identical: dropping the key would silently narrow a
 * published type, turning a false claim into a missing one. So the value was
 * weakened to what this layer can prove and the KEY was kept — and only a pin
 * can tell those two edits apart afterwards, because deleting the entry
 * outright also removes the false claim and every runtime suite stays green.
 *
 * ## Why the value cannot simply be corrected
 *
 * The renderer registered for `'kanban'` is `ObjectKanbanRenderer` in
 * `@object-ui/plugin-kanban`, which consumes that package's `KanbanSchema`.
 * `@object-ui/types` cannot name it: the import is a phantom dependency
 * (`check:phantom-deps` names the pair), and declaring the dependency closes
 * the cycle `@object-ui/types` → `@object-ui/plugin-kanban` → `@object-ui/types`.
 * objectui#6172's ruling (2026-08-31) kept the plugin's bare names there;
 * objectui#7664's ruling (a) (2026-09-05) reverses that half — this package's
 * `'kanban'` arm is rewritten to the plugin's shape and the entry re-pointed at
 * it, so the value pinned below is TRANSITIONAL. What IS provable here — a
 * node tagged `'kanban'` — is what it states; the plugin's face satisfies it in
 * `packages/plugin-kanban/src/__tests__/schema-registry-kanban-honesty-7645.test.ts`.
 *
 * ## These assertions are compile-time only
 *
 * They mean something only because this package type-checks its tests:
 * `tsconfig.json` excludes test files (they must not emit into `dist`) and
 * `tsconfig.test.json` picks them back up, chained off the package's
 * `type-check` script. Vitest strips types without checking them, so a green
 * vitest run is NOT evidence about anything below. The instrument is
 * `tsc -p packages/types/tsconfig.test.json`.
 */

import { describe, it, expect } from 'vitest';
import type {
  SchemaRegistry,
  ComponentType,
  DeclarativeKanbanSchema,
} from '../index';

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

describe("SchemaRegistry's kanban key outlives its value's retreat", () => {
  it('is pinned at compile time', () => {
    // Non-vacuity controls. `Equal<any, X>` is `false` and `any` satisfies
    // every `extends`, so an `any` on either side would let the pins below
    // pass while checking nothing at all.
    type _RegistryIsReal = Assert<Equal<IsAny<SchemaRegistry>, false>>;
    type _DeclarativeIsReal = Assert<Equal<IsAny<DeclarativeKanbanSchema>, false>>;

    // 1. The published union still yields `'kanban'`. `Extract` collapses to
    //    `never` if the key is ever removed, which fails this pin loudly.
    type _KeyKept = Assert<Equal<Extract<ComponentType, 'kanban'>, 'kanban'>>;

    // 2. The value no longer claims the declarative authoring face. This is
    //    the objectui#7645 defect itself; re-pointing the entry turns it red.
    type _ValueIsNotTheDeclarativeFace = Assert<
      Equal<Equal<SchemaRegistry['kanban'], DeclarativeKanbanSchema>, false>
    >;

    // 3. What it DOES assert is true and non-empty: a node tagged `'kanban'`.
    //    `never` or `unknown` in that slot fails here rather than passing as a
    //    quieter kind of nothing.
    type _ValueIsATaggedNode = Assert<Equal<SchemaRegistry['kanban']['type'], 'kanban'>>;

    // 4. Nothing was invalidated by the retreat: the declarative face still
    //    satisfies the weaker claim, as does the plugin's face (pinned in
    //    `@object-ui/plugin-kanban`, the only package that can name both).
    type _DeclarativeStillSatisfiesIt = Assert<
      DeclarativeKanbanSchema extends SchemaRegistry['kanban'] ? true : false
    >;

    expect(true).toBe(true);
  });
});
