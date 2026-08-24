/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5874 — this package's private copy of the reference-bearing field
 * family converges onto `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`.
 *
 * The copy was the inline disjunction `isLookup` inside `resolveDisplay`, the
 * card-description helper in `ObjectKanban.tsx`. It neither derived from nor
 * pinned against the shared set, and it diverged from it in BOTH directions:
 * it lacked `user` and `tree`, and carried a fifth spelling `reference` that no
 * producer can emit.
 *
 * ## Why the load-bearing pin is IDENTITY, not membership
 *
 * Every membership assertion below is satisfied by a private
 * `new Set(['lookup', 'master_detail', 'tree', 'user'])` holding the same
 * strings — i.e. by a re-fork of exactly the kind this change removed. So the
 * pin that decides the convergence spies on the `has` of the object core
 * exports: a call is recorded only if the face under test consulted THAT
 * object, so a member-identical private copy leaves the spy empty and fails
 * here, where a value check would pass ON the defect. Same shape as
 * objectui#4770 / #4790 / #4815 / #5312 / #5692.
 *
 * ## ⚠️ This face has NO behavioural counter-probe, and that is a finding
 *
 * The identity pin below is the ONLY thing this file can assert about the
 * convergence, because the guard it re-homes is unreachable in its own right.
 * Measured on the merge base, `resolveDisplay` reads:
 *
 *     if (isLookup && isOpaqueId(raw)) return undefined;
 *     if (isOpaqueId(raw)) return undefined;
 *
 * The second line subsumes the first for every input, so `isLookup` cannot
 * change any outcome — no membership delta on this face, in EITHER direction,
 * is observable through `ObjectKanban`'s rendered output. That is why there is
 * no "a `user` field is now treated as a relation here" probe: writing one
 * would mean writing an assertion that cannot fail, which is worse than
 * recording the absence.
 *
 * The subsumption is a DIFFERENT defect from the one this card fixes (a
 * redundant guard, not a forked table), so it is filed rather than fixed in
 * passing — objectui#6063. Converging the copy is still correct on its own
 * terms: the day that guard is made live again it reads the family instead of a
 * stale literal, and this pin is what holds it there.
 *
 * Ablation direction, predicted before running: restore the private copy
 * (`def?.type === 'lookup' || def?.type === 'master_detail' ||
 * def?.type === 'reference'`) and the identity pin goes RED (the spy records no
 * call) while the member-set assertion stays GREEN — that contrast is the whole
 * reason the pin is on identity rather than on members.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { EXPANDABLE_FIELD_TYPES } from '@object-ui/core';
import { FieldType } from '@objectstack/spec/data';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-kanban`.
import '../index';
// The cards asserted below render INSIDE `KanbanRenderer`'s `React.lazy`
// boundary. Importing the chunk at module scope bills the cold transform to the
// import phase (unbounded) instead of racing a `waitFor` budget under full
// parallelism — the objectui#3010 rule, same specifier as `index.tsx`'s factory
// so ESM's module cache makes that factory resolve immediately.
import '../KanbanImpl';

const SPEC_FIELD_TYPES: readonly string[] = [
  ...(FieldType as unknown as { options: readonly string[] }).options,
];

/**
 * A board with NO `cardFields` and NO `highlightFields`, so cards fall to the
 * legacy semantic heuristic — the only branch that calls `resolveDisplay`, and
 * therefore the only branch that reaches the converged guard. `account` and
 * `owner` are two of the hard-coded keys that helper probes.
 */
function makeAdapter(fieldTypes: Record<string, string>) {
  return {
    find: vi.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Acme renewal',
          status: 'open',
          account: 'aXbY9zHWBfjYjZ4',
          owner: 'qWeRtY7uIoPa1Sd',
        },
      ],
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'deal',
      fields: {
        name: { type: 'text' },
        status: { type: 'text' },
        account: { type: fieldTypes.account ?? 'lookup' },
        owner: { type: fieldTypes.owner ?? 'user' },
      },
    }),
  };
}

async function renderBoard(fieldTypes: Record<string, string> = {}) {
  const adapter = makeAdapter(fieldTypes);
  const { container } = render(
    <SchemaRendererProvider dataSource={adapter as any}>
      <SchemaRenderer
        schema={
          {
            type: 'object-kanban',
            objectName: 'deal',
            groupBy: 'status',
            columns: [{ id: 'open', title: 'Open' }],
          } as any
        }
      />
    </SchemaRendererProvider>,
  );
  // The cards render past a Suspense boundary and after the fetch resolves.
  await waitFor(() => expect(container.textContent).toContain('Acme renewal'));
  return container;
}

/**
 * Record every `EXPANDABLE_FIELD_TYPES.has` call made while `exercise()` runs,
 * ATTRIBUTED to the function that made it, and return the arguments that came
 * from `resolveDisplay` alone.
 *
 * ⚠️ The attribution is load-bearing, not decoration. `ObjectKanban.tsx` also
 * imports `buildExpandFields`, which consults the SAME shared object once per
 * schema field on every render. A bare `vi.spyOn(...).mock.calls` pin therefore
 * stays GREEN when `resolveDisplay` is re-forked — measured, not feared: the
 * first draft of this file did exactly that and survived its own ablation, so
 * the pin was reporting on `buildExpandFields`' calls and pinning nothing.
 * Filtering by the calling frame is what makes the ablation red.
 *
 * The frame name IS the read site's identifier. Renaming `resolveDisplay` must
 * update this helper — the pin naming the site it guards is the point.
 */
function hasCallsFrom(site: string, exercise: () => Promise<unknown>) {
  const seen: string[] = [];
  const real = EXPANDABLE_FIELD_TYPES.has.bind(EXPANDABLE_FIELD_TYPES);
  const spy = vi
    .spyOn(EXPANDABLE_FIELD_TYPES, 'has')
    .mockImplementation((key: string) => {
      if (new Error().stack?.includes(site)) seen.push(key);
      return real(key);
    });
  return exercise().then(
    () => {
      spy.mockRestore();
      return seen;
    },
    (err) => {
      spy.mockRestore();
      throw err;
    },
  );
}

afterEach(() => {
  // The pin installs a spy on the Set object EXPORTED by core — a shared,
  // module-level object. A leaked spy would follow every later file in the
  // worker, so restoring is not optional here.
  vi.restoreAllMocks();
});

describe("the kanban card's relation rule is core's object, not a copy (objectui#5874)", () => {
  it('`resolveDisplay` asks `@object-ui/core` EXPANDABLE_FIELD_TYPES', async () => {
    // The spy is installed on the Set exported by core and records a call only
    // if THAT object was consulted, from THIS read site. A member-identical
    // private copy leaves it empty, so this fails where a value check passes.
    const calls = await hasCallsFrom('resolveDisplay', () =>
      renderBoard({ account: 'lookup' }),
    );
    expect(calls).toContain('lookup');
  });

  it('reaches that object on the person path too, not just the lookup path', async () => {
    // `user` and `lookup` are different members of the same set; a convergence
    // that reconnected one spelling only would leave the other forked. This is
    // as close to the restoration half as this face can be checked — see the
    // subsumption note in the file docblock for why there is no behavioural
    // probe to pair with it.
    const calls = await hasCallsFrom('resolveDisplay', () =>
      renderBoard({ account: 'user' }),
    );
    expect(calls).toContain('user');
  });

  it('the UNattributed spy would NOT have failed — why the frame filter is here', async () => {
    // `buildExpandFields`, imported into the same module, consults the same
    // shared object on every render. So "some call happened" is satisfied by a
    // face that never converged. This assertion is what the two pins above
    // would degrade into without the frame filter, and it is green either way.
    const spy = vi.spyOn(EXPANDABLE_FIELD_TYPES, 'has');
    try {
      await renderBoard({ account: 'lookup' });
      const fromAnywhere = spy.mock.calls.map(([k]) => k);
      expect(fromAnywhere.length).toBeGreaterThan(0);
      const stacksAttributed = fromAnywhere.length;
      expect(stacksAttributed).toBeGreaterThan(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('a member-identical private copy would NOT satisfy the pin — the contrast', () => {
    // Documents, executably, why the two pins above are not membership checks:
    // this assertion is true of the shared object AND of any private set
    // holding the same strings, so it cannot tell a converged face from a
    // re-forked one. The spies above can.
    const memberIdenticalCopy = new Set(['lookup', 'master_detail', 'tree', 'user']);
    expect([...EXPANDABLE_FIELD_TYPES].sort()).toEqual([...memberIdenticalCopy].sort());
    expect(EXPANDABLE_FIELD_TYPES).not.toBe(memberIdenticalCopy);
  });
});

describe('the card still renders — regression control', () => {
  // Must stay green through BOTH ablation legs. If it moves, the convergence
  // took the card renderer with it and the pin above is reporting on rubble
  // rather than on a re-homed rule.
  it('a board with no card config still renders its records', async () => {
    const container = await renderBoard();
    expect(container.textContent).toContain('Acme renewal');
    expect(container.textContent).toContain('Open');
  });
});

describe('the `reference` drop is a no-op on real data — the measured direction', () => {
  /**
   * The measurement, kept as an executable pin rather than as prose in a PR.
   * Controls run on the same read as the subject, so a probe that had lost hold
   * of the vocabulary (an empty list, the wrong export) fails as a broken probe
   * instead of reporting the subject absent.
   */
  it('every LIVE control IS a spec `FieldType`, and every DEAD one is not', () => {
    for (const type of EXPANDABLE_FIELD_TYPES) {
      expect(SPEC_FIELD_TYPES, `'${type}' is not a spec FieldType`).toContain(type);
    }
    expect(SPEC_FIELD_TYPES).not.toContain('owner');
    expect(SPEC_FIELD_TYPES).not.toContain('zzz_not_a_field_type');
  });

  it('SUBJECT — `reference` is not a declarable field type', () => {
    // The whole licence for dropping it. If the spec ever adds the spelling,
    // this goes red and the "should the shared family gain `reference`?"
    // question reopens — deliberately, rather than the drop remaining correct
    // only by accident.
    expect(SPEC_FIELD_TYPES).not.toContain('reference');
  });
});
