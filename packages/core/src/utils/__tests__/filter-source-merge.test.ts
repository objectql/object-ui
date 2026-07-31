/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Merging the filter sources a view can carry.
 *
 * Three shapes are in circulation and all are legitimate — a spec
 * `ViewFilterRule[]`, an AST node, and a MongoDB-style object. Renderers merged
 * them by hand and got two things wrong, both silent:
 *
 *   1. They tested `source.length > 0` before using it. That is `undefined > 0`
 *      for an object, so a `table.defaultFilters` (declared `Record<string,
 *      any>`) was DROPPED and the view returned every record.
 *   2. They SPREAD a source into the `and` (`['and', ...rules]`). That is only
 *      correct when the source is an array of nodes; for a `ViewFilterRule[]`
 *      it puts bare rule objects where the AST expects nodes. `isFilterAST`
 *      rejects that (a 400 since objectstack#4121) and `parseFilterAST` reads
 *      the rule as a Mongo condition — filtering on columns literally named
 *      `field`, `operator` and `value`.
 *
 * The emitted shape is asserted against the server's own `isFilterAST` rather
 * than a restated literal wherever the result is an AST.
 */

import { describe, it, expect } from 'vitest';
import { isFilterAST, parseFilterAST } from '@objectstack/spec/data';
import { toFilterNode, mergeFilterNodes } from '../filter-converter';

const RULES = [{ field: 'stage', operator: 'eq', value: 'won' }];
const TUPLE = ['owner', '=', 'me'];

describe('toFilterNode', () => {
  it('passes a non-empty array source through unchanged', () => {
    expect(toFilterNode(RULES)).toEqual(RULES);
    expect(toFilterNode([TUPLE])).toEqual([TUPLE]);
  });

  it('converts a MongoDB-style object into an AST node', () => {
    expect(toFilterNode({ status: 'active' })).toEqual(['status', '=', 'active']);
  });

  it('treats absent and empty sources as nothing', () => {
    for (const empty of [undefined, null, [], {}, '', 0]) {
      expect(toFilterNode(empty)).toBeUndefined();
    }
  });
});

describe('mergeFilterNodes', () => {
  it('returns undefined when every source is empty', () => {
    expect(mergeFilterNodes(undefined, [], {})).toBeUndefined();
  });

  it('returns a lone source as-is rather than wrapping it in a pointless and', () => {
    expect(mergeFilterNodes([TUPLE], undefined)).toEqual([TUPLE]);
  });

  it('wraps each source as its own child — never spreads it', () => {
    // The regression. Spreading would give ['and', {field…}, 'owner', '=', 'me'].
    expect(mergeFilterNodes(RULES, TUPLE)).toEqual(['and', RULES, TUPLE]);
  });

  it('keeps an object source instead of dropping it', () => {
    // `table.defaultFilters` is declared `Record<string, any>`; the old
    // `.length > 0` guard read false and the whole filter disappeared.
    expect(mergeFilterNodes({ status: 'active' }, TUPLE))
      .toEqual(['and', ['status', '=', 'active'], TUPLE]);
  });
});

describe('what reaches the server', () => {
  /**
   * `ViewFilterRule[]` is not itself AST — the adapter translates it on the way
   * out — so `isFilterAST` is only the right oracle for the all-AST cases.
   */
  it('produces a node the server accepts when every source is AST', () => {
    expect(isFilterAST(mergeFilterNodes([TUPLE], ['amount', '>', 1]))).toBe(true);
    expect(isFilterAST(mergeFilterNodes({ status: 'active' }, ['amount', '>', 1]))).toBe(true);
    expect(isFilterAST(mergeFilterNodes({ status: 'active' }))).toBe(true);
  });

  it('an object source survives the round trip to a real predicate', () => {
    const merged = mergeFilterNodes({ status: 'active' }, ['amount', '>', 1]);
    expect(parseFilterAST(merged)).toEqual({
      $and: [{ status: 'active' }, { amount: { $gt: 1 } }],
    });
  });

  it('the spread shape it replaces was NOT acceptable — pinning why', () => {
    // What `['and', ...rules, ...tuples]` produced. Kept as executable evidence
    // that the wrapping above is not a stylistic preference.
    const spread = ['and', ...RULES, TUPLE];
    expect(isFilterAST(spread)).toBe(false);
    // Worse than rejected: read as a predicate over three columns that do not exist.
    expect(parseFilterAST(spread)).toEqual({
      $and: [{ field: 'stage', operator: 'eq', value: 'won' }, { owner: 'me' }],
    });
  });
});
