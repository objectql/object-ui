/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The renderer's face IS the declared `'kanban'` arm (objectui#7664, maintainer
 * ruling (a), 2026-09-05).
 *
 * ## Why this pin lives here
 *
 * `@object-ui/types` now declares the plugin dialect and this package imports
 * it back (`../types` re-exports `KanbanSchema` and its four companions), so
 * the ruling's "the four registered renderers' props still type-check against
 * the declared schema" is a claim about THIS package's prop types — and this is
 * the only package that can see both sides: the declaration through the
 * workspace dependency, the renderers through `../index`.
 *
 * The retired objectui#7645 pin that sat here asserted two dialects still
 * existed (`Equal<KanbanSchema, DeclarativeKanbanSchema>` was `false`). With the
 * declarative trio retired that pin has no second operand; what replaces it is
 * the stronger claim the ruling makes — ONE declaration.
 *
 * ## The instrument
 *
 * Compile-time. Vitest strips types without checking them, so a green run of
 * this file proves nothing on its own; the assertions are read by
 * `tsc -p packages/plugin-kanban/tsconfig.test.json`, chained off this
 * package's `type-check` script. That project sets `"paths": {}`, so
 * `@object-ui/types` resolves through the workspace dependency to
 * `packages/types/dist/index.d.ts` — BUILD `@object-ui/types` before believing
 * either colour this file reports. The one runtime assertion — the four
 * registrations exist — is the anti-vacuity control for the prop-type pins:
 * a prop type is only worth pinning for a renderer that is registered.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import type { SchemaRegistry, KanbanSchema as DeclaredKanbanSchema, KanbanColumn as DeclaredKanbanColumn, KanbanCard as DeclaredKanbanCard } from '@object-ui/types';
import type { KanbanSchema, KanbanColumn, KanbanCard } from '../types';
import type { ObjectKanbanComponentProps } from '../ObjectKanban';
import type { KanbanRendererProps } from '../index';
import '../index';

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

// Non-vacuity controls: `any` on either side would satisfy every `extends`
// below while checking nothing.
type _PluginFaceIsReal = Assert<Equal<IsAny<KanbanSchema>, false>>;
type _RegistryIsReal = Assert<Equal<IsAny<SchemaRegistry>, false>>;

// 1. ONE declaration: what this package exports as `KanbanSchema` /
//    `KanbanColumn` / `KanbanCard` is the `@object-ui/types` declaration, not a
//    structurally-equal copy. `Equal` is invariant, so a re-declared twin that
//    drifted by one member turns this red.
type _SchemaIsTheDeclaredOne = Assert<Equal<KanbanSchema, DeclaredKanbanSchema>>;
type _ColumnIsTheDeclaredOne = Assert<Equal<KanbanColumn, DeclaredKanbanColumn>>;
type _CardIsTheDeclaredOne = Assert<Equal<KanbanCard, DeclaredKanbanCard>>;

// 2. The map that calls itself the Single Source of Truth names the same type
//    the registered renderer consumes — the objectui#7645 defect, closed by the
//    ruling rather than by weakening the entry.
type _RegistryEntryIsThisFace = Assert<Equal<SchemaRegistry['kanban'], KanbanSchema>>;

// 3. The renderers' props type-check against the declared schema:
//    - `ObjectKanban` (behind `ObjectKanbanRenderer`, registered for `'kanban'`
//      AND `'object-kanban'`) takes exactly the declared face as its `schema`;
type _ObjectKanbanTakesTheDeclaredFace = Assert<Equal<ObjectKanbanComponentProps['schema'], KanbanSchema>>;
//    - `KanbanRenderer` (`'kanban-ui'`) accepts a declared board — its inline
//      prop schema is a looser projection (`columns?: Array<any>`), so the
//      claim is assignability, not identity;
type _KanbanUiAcceptsTheDeclaredFace = Assert<KanbanSchema extends KanbanRendererProps['schema'] ? true : false>;
//    - `'kanban-enhanced'` is registered as `({ schema }: { schema: any })` and
//      accepts anything by construction — nothing to pin, and pinning `any`
//      would be the vacuity the controls above exclude.

// 4. The declared face is still a tagged node, and a raw record field on a
//    card still reads `any` (the open-record index signature survived the move).
type _FaceIsTagged = Assert<Equal<KanbanSchema['type'], 'kanban'>>;
type _CardIsAnOpenRecord = Assert<Equal<IsAny<KanbanCard['dueDate']>, true>>;

describe('the registered kanban renderers consume the declared arm (objectui#7664)', () => {
  it('is pinned at compile time', () => {
    expect(true).toBe(true);
  });

  it('all four registrations the ruling counts exist — the prop-type pins above are about live renderers', () => {
    for (const type of ['kanban', 'kanban-ui', 'kanban-enhanced', 'object-kanban']) {
      expect(ComponentRegistry.has(type), `\`${type}\` is not registered`).toBe(true);
    }
    // `'kanban'` and `'object-kanban'` are the SAME renderer, which is why one
    // prop-type pin (`ObjectKanbanComponentProps`) covers both keys.
    expect(ComponentRegistry.get('kanban')).toBe(ComponentRegistry.get('object-kanban'));
  });
});
