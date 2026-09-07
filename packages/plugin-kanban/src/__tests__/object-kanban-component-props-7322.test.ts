/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectKanbanComponentProps.schema` names EVERY node type the component is
 * registered for, and nothing else (objectui#7322 item ②).
 *
 * ## The defect this pins closed
 *
 * `ObjectKanbanRenderer` is registered under two keys — `'object-kanban'` and
 * `'kanban'` — and the two keys have different declared node types
 * (`ObjectKanbanSchema`, `type: 'object-kanban'`; `KanbanSchema`,
 * `type: 'kanban'`). The prop named `KanbanSchema` alone, so no
 * `object-kanban` node was assignable to the component that renders it. The
 * cost was visible and paid in this package: five of the six in-package
 * fixtures that mount an `object-kanban` board escaped the prop with
 * `as never`, and the `titleField` read inside `ObjectKanban.tsx` was spelled
 * `(schema as any).titleField` because the named arm does not declare it.
 *
 * ## Why the derivation, and not a list of two strings
 *
 * A hand-written pair of keys is exactly what the defect survived under: the
 * second registration was added and the prop never followed, and no assertion
 * anywhere related the two. So suite 2 EXTRACTS the registered keys from
 * `../index.tsx` off disk and requires that set to equal the arms of the
 * union — a third registration, or a re-key of an existing one, turns it red
 * naming the key, and the fix is to move the prop rather than the test.
 *
 * ## The instrument
 *
 * Suite 1 is compile-time. Vitest strips types without checking them, so a
 * green run proves nothing on its own: the assertions are read by
 * `tsc -p packages/plugin-kanban/tsconfig.test.json`, chained off this
 * package's `type-check` script. That project sets `"paths": {}`, so
 * `@object-ui/types` resolves through the workspace dependency to
 * `packages/types/dist/index.d.ts` — BUILD `@object-ui/types` before believing
 * either colour suite 1 reports. Suite 2 is a real runtime assertion and needs
 * no build.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentRegistry } from '@object-ui/core';
import type { KanbanSchema, ObjectKanbanSchema, ObjectGridSchema } from '@object-ui/types';
import type { ObjectKanbanComponentProps } from '../ObjectKanban';
import { ObjectKanbanRenderer } from '../index';
import '../index';

/* -------------------------------------------------------------------------- */
/* Suite 1 — compile-time, read by tsconfig.test.json.                         */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

type Prop = ObjectKanbanComponentProps['schema'];

// Non-vacuity controls. `any` anywhere below would satisfy every `extends`
// while checking nothing — and `any` is precisely what this member would have
// been widened to by the lazy fix.
type _PropIsNotAny = Assert<Equal<IsAny<Prop>, false>>;
type _KanbanArmIsReal = Assert<Equal<IsAny<KanbanSchema>, false>>;
type _ObjectKanbanArmIsReal = Assert<Equal<IsAny<ObjectKanbanSchema>, false>>;

// 1. Both registered node types are accepted. The second leg is the one this
//    card added; the first is what objectui#7664 already required and must not
//    regress.
type _AcceptsTheKanbanNode = Assert<KanbanSchema extends Prop ? true : false>;
type _AcceptsTheObjectKanbanNode = Assert<ObjectKanbanSchema extends Prop ? true : false>;

// 2. And nothing else. `ObjectGridSchema` is the control: a sibling
//    `@object-ui/types` node type, declared in the same file as
//    `ObjectKanbanSchema`, registered to a DIFFERENT renderer. If this ever
//    reads `true` the prop has been widened to something structural (or to
//    `any`) rather than to the two declared arms.
type _RejectsAnUnregisteredNode = Assert<Equal<ObjectGridSchema extends Prop ? true : false, false>>;

// 3. The discriminant carries exactly the two registered keys. This is the
//    claim suite 2 checks the other half of: here, what the TYPE says; there,
//    what `index.tsx` actually registers.
type _DiscriminantIsTheTwoKeys = Assert<Equal<Prop['type'], 'kanban' | 'object-kanban'>>;

/* -------------------------------------------------------------------------- */
/* Suite 2 — runtime, derived from the read site.                              */
/* -------------------------------------------------------------------------- */

const INDEX_TSX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx');

/** Every key `index.tsx` registers `ObjectKanbanRenderer` under. */
function registeredKeys(): string[] {
  const src = readFileSync(INDEX_TSX, 'utf8');
  const keys: string[] = [];
  const re = /ComponentRegistry\.register\(\s*'([^']+)'\s*,\s*ObjectKanbanRenderer\b/g;
  for (const m of src.matchAll(re)) keys.push(m[1]);
  return keys.sort();
}

describe('ObjectKanbanComponentProps.schema names every registered node type (objectui#7322)', () => {
  it('is pinned at compile time', () => {
    expect(true).toBe(true);
  });

  it('index.tsx registers ObjectKanbanRenderer under exactly the two keys the prop union names', () => {
    // Red when a third registration is added, or an existing key is renamed,
    // without moving `ObjectKanbanComponentProps['schema']` to match. The
    // literals here are the union's arms restated: `KanbanSchema['type']` is
    // `'kanban'` and `ObjectKanbanSchema['type']` is `'object-kanban'`, which
    // suite 1's `_DiscriminantIsTheTwoKeys` holds to the prop.
    expect(registeredKeys()).toEqual(['kanban', 'object-kanban']);
  });

  it('the extraction is lit — it finds the reader it claims to read, and no other renderer', () => {
    // Anti-vacuity for the assertion above: a regex that matched nothing would
    // return `[]` and a same-shaped `toEqual` against `[]` would pass forever.
    const keys = registeredKeys();
    expect(keys.length).toBeGreaterThan(0);
    // `'kanban-ui'` and `'kanban-enhanced'` are registered in the same file to
    // OTHER renderers — the control that the pattern discriminates on the
    // component, not merely on the word `register`.
    expect(keys).not.toContain('kanban-ui');
    expect(keys).not.toContain('kanban-enhanced');
    expect(ComponentRegistry.has('kanban-ui')).toBe(true);
    expect(ComponentRegistry.has('kanban-enhanced')).toBe(true);
  });

  it('every extracted key resolves to that renderer in the live registry', () => {
    // Ties the off-disk reading to the running registry, so a key that is
    // registered in a source form this regex cannot see still has to show up
    // through `ComponentRegistry` — and a key it read from a comment or a dead
    // branch would fail here.
    for (const key of registeredKeys()) {
      expect(ComponentRegistry.get(key), `\`${key}\` does not resolve to ObjectKanbanRenderer`).toBe(ObjectKanbanRenderer);
    }
  });
});
