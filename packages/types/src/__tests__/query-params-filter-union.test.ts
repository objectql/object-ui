/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3909 — `QueryParams.$filter` declares BOTH shapes the data sources
 * accept, and binds the array half to `@objectstack/spec`'s `FilterArray`
 * rather than restating it.
 *
 * ## Why this file exists at all
 *
 * The defect it pins was invisible to every runtime suite, and had to be: the
 * declaration was `Record< string, any >`, which **structurally accepts arrays**
 * (they satisfy its string index). So the two producers that have fed ObjectQL
 * AST arrays through this slot all along — `plugin-list`'s
 * `buildEffectiveFilter` (grid and export) and `plugin-view`'s `ObjectView`
 * (calendar / kanban / gallery / timeline) — type-checked, ran, and shipped
 * correct results. Nothing was broken at runtime and nothing could go red.
 *
 * The cost was paid on the type face instead, in both directions:
 *
 * 1. The type **blocked nothing while describing one legal shape as if it were
 *    the only one**. objectui#3831 is what that buys: a `Record< string, any >`
 *    slot accepted a rule array, an object spread flattened it to
 *    `{"0": {...}}`, types stayed green, and the query filtered on a column
 *    literally named `0`.
 * 2. Someone writing a new consumer reads the type and its `@example`,
 *    concludes only the record form is legal, and adds a tolerant conversion
 *    for the array path — the "widen the consumer to tolerate the producer"
 *    shape AGENTS.md #0.1 forbids.
 *
 * Both failure modes are compile-time by nature, so the pins are too. Reverting
 * `$filter` to `Record< string, any >` leaves every runtime suite green and
 * turns THIS FILE red under `tsc -p tsconfig.test.json` (the `type-check`
 * script) — the drift's own signature, reproduced deliberately.
 *
 * ## What is NOT pinned here
 *
 * That the union is the *authoritative* accepted set. It is not: the authority
 * is `translateFilterToAST` (`@object-ui/data-objectstack`), which enumerates
 * five input shapes. A second list here would be a third place to drift from —
 * which is exactly how two operator vocabularies came apart in #3948. The
 * binding below is to the spec's `FilterArray`, so the array half cannot fork
 * locally.
 */

import { describe, it, expect } from 'vitest';
import type { FilterArray } from '@objectstack/spec/data';
import type { QueryParams } from '../data';

type Assert< T extends true > = T;
/** True when `V` is accepted by the `$filter` slot. */
type AcceptsFilter< V > = V extends QueryParams['$filter'] ? true : false;

describe('QueryParams.$filter — declares the union it actually accepts (#3909)', () => {
  it('accepts the MongoDB-style field-keyed record', () => {
    type _Record = Assert< AcceptsFilter< { age: { $gt: number } } > >;
    const params: QueryParams = { $filter: { age: { $gt: 18 }, status: 'active' } };
    expect(params.$filter).toEqual({ age: { $gt: 18 }, status: 'active' });
  });

  it('accepts a bare AST comparison tuple with no cast', () => {
    // The shape `buildEffectiveFilter` returns for a single condition. Before
    // #3909 this compiled only because arrays satisfy `Record`'s string index —
    // accepted by accident rather than by declaration.
    const params: QueryParams = { $filter: ['status', '=', 'active'] };
    expect(params.$filter).toEqual(['status', '=', 'active']);
  });

  it('accepts a logical AST group with no cast', () => {
    // What `mergeFilterNodes` returns once more than one source is active.
    const params: QueryParams = {
      $filter: ['and', ['age', '>=', 18], ['status', '=', 'active']],
    };
    expect(Array.isArray(params.$filter)).toBe(true);
  });

  it('accepts the legacy bare list, combined with implicit AND', () => {
    const params: QueryParams = {
      $filter: [['stage', '=', 'won'], ['amount', '>', 1000]],
    };
    expect(Array.isArray(params.$filter)).toBe(true);
  });

  it('binds the array half to the spec rather than restating it', () => {
    // A locally re-declared AST type would satisfy the assignments above just
    // as well — and would then be free to drift from the spec's vocabulary the
    // way two hand-written operator lists did (#3948). This pin fails if the
    // union stops admitting the spec's own `FilterArray`.
    type _Bound = Assert< AcceptsFilter< FilterArray > >;
    const fromSpec: FilterArray = ['status', '=', 'active'];
    const params: QueryParams = { $filter: fromSpec };
    expect(params.$filter).toBe(fromSpec);
  });

  it('still refuses a value that is neither shape', () => {
    // The union documents; it must not have become `any` on the way. Note the
    // slot sits on an interface that also carries `[key: string]: any` — these
    // pins prove the declared property still wins over that index signature,
    // which is the whole reason the declaration is worth anything.
    // @ts-expect-error a number is not a filter
    const bad: QueryParams = { $filter: 42 };
    // @ts-expect-error a string is not a filter
    const alsoBad: QueryParams = { $filter: 'status eq active' };
    expect(bad.$filter).toBe(42);
    expect(alsoBad.$filter).toBe('status eq active');
  });
});
