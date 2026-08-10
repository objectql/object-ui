/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * View operator → filter-AST operator parity (#2901, objectstack#3948).
 *
 * The spec ships two operator vocabularies that must agree at this boundary:
 *
 *   - `VIEW_FILTER_OPERATORS` (`ui/view.zod.ts`) — what an author may declare on
 *     a `ViewFilterRule`, and what `ViewFilterRuleSchema` validates against.
 *   - `VALID_AST_OPERATORS` (`data/filter.zod.ts`) — what gates `isFilterAST()`
 *     on the server, deciding whether a filter is parsed into a query at all.
 *
 * They do NOT overlap: 8 of the 19 canonical view operators are absent from the
 * AST set. `mapOperator` is what bridges them, and a gap in it is invisible —
 * `isFilterAST()` returns false, the protocol passes the array through
 * unconverted, and driver-sql then skips it entirely. **No WHERE clause, no
 * error, every row returned.** That is how `before`/`after` shipped broken: they
 * are canonical view operators with no entry in the bridge.
 *
 * These tests assert the bridge is total, so the next operator the spec adds to
 * the view vocabulary fails here instead of silently returning unfiltered rows.
 */
import { describe, it, expect } from 'vitest';
import { VALID_AST_OPERATORS, isFilterAST } from '@objectstack/spec/data';
import { VIEW_FILTER_OPERATORS, VIEW_FILTER_OPERATOR_ALIASES } from '@objectstack/spec/ui';
import { mapOperator, normalizeFilterCondition } from '../ListView';

/**
 * Operators this bridge deliberately resolves without reaching the AST gate.
 *
 * Every token here must still be a member of `VIEW_FILTER_OPERATORS` — the
 * ratchet below enforces it. Subtracting a name the spec has retired excuses
 * nothing and must be deleted rather than left as a dead subtraction (#3628).
 */
const HANDLED_BEFORE_MAPPING = new Set([
  // convertFilterGroupToAST rewrites these to `[field, '=' | '!=', null]`
  // before mapOperator is consulted, so they never need an AST spelling.
  'is_empty', 'is_not_empty',
]);

describe('mapOperator bridges the spec view vocabulary onto the AST vocabulary', () => {
  it('reads both vocabularies from the spec', () => {
    // Guards every assertion below against silently passing on an empty list.
    expect(VIEW_FILTER_OPERATORS.length).toBeGreaterThan(0);
    expect(VALID_AST_OPERATORS.size).toBeGreaterThan(0);
  });

  // The exclusion ratchet (#3628). The sweep below subtracts a hand-written set
  // from a spec-derived vocabulary, and that subtraction only excuses something
  // while the spec still lists the subtracted tokens. Once upstream retires or
  // renames one, the sweep stays green (it is still total over what remains) but
  // the row becomes dead weight, and its comment goes on telling the next reader
  // that "the view layer rewrites this first" about an operator no author can
  // declare any more. That is the shape that rotted 37 of 82 deny-list entries in
  // #3601 with nothing to report it — a hand-written list beside a spec-derived
  // vocabulary and no assertion that its members still exist in that vocabulary.
  //
  // Collected rather than asserted per entry on purpose (same call as PR #3623):
  // vocabulary retirements land as whole families, and failing on the first entry
  // would hide the rest.
  it('every HANDLED_BEFORE_MAPPING token is still in the spec view vocabulary', () => {
    const vocabulary = new Set<string>(VIEW_FILTER_OPERATORS);
    const retired = [...HANDLED_BEFORE_MAPPING].filter((op) => !vocabulary.has(op));
    expect(
      retired,
      `VIEW_FILTER_OPERATORS no longer lists these HANDLED_BEFORE_MAPPING tokens: `
        + `${retired.join(', ')}. The spec has retired them, so subtracting them from `
        + 'the sweep below excuses nothing — delete each from the set (with the comment '
        + 'claiming the view layer rewrites it) rather than leaving a dead subtraction',
    ).toEqual([]);
  });

  const bridged = VIEW_FILTER_OPERATORS.filter((op) => !HANDLED_BEFORE_MAPPING.has(op));

  it.each(bridged)('%s maps to an AST-valid operator', (viewOp) => {
    const mapped = mapOperator(viewOp);
    expect(
      VALID_AST_OPERATORS.has(String(mapped).toLowerCase()),
      `mapOperator('${viewOp}') → '${mapped}', which VALID_AST_OPERATORS rejects. `
        + 'isFilterAST() will return false and the filter will be silently dropped '
        + 'server-side — an unfiltered result set, not an error.',
    ).toBe(true);
  });

  it.each(bridged)('a single %s condition survives the isFilterAST gate', (viewOp) => {
    // The reachable shape: one condition, AND logic, emitted as a bare triple.
    // This is exactly what silently full-scanned before the fix.
    const value = viewOp === 'in' || viewOp === 'not_in' ? ['a', 'b'] : 'x';
    const triple = normalizeFilterCondition(['some_field', mapOperator(viewOp), value]);
    expect(
      isFilterAST(triple),
      `a '${viewOp}' filter produced ${JSON.stringify(triple)}, which isFilterAST() rejects`,
    ).toBe(true);
  });

  it('also bridges every legacy alias the spec still folds', () => {
    // Stored view metadata carries these: saveMeta persists the authored body
    // verbatim, so the spec's z.preprocess normalization never reaches the row.
    const unbridged = Object.keys(VIEW_FILTER_OPERATOR_ALIASES)
      .filter((alias) => !HANDLED_BEFORE_MAPPING.has(VIEW_FILTER_OPERATOR_ALIASES[alias]))
      .filter((alias) => !VALID_AST_OPERATORS.has(String(mapOperator(alias)).toLowerCase()));
    expect(
      unbridged,
      'these legacy spellings exist in stored view metadata and map to no AST operator',
    ).toEqual([]);
  });

  it('emits `nin`, never the spaced `not in`, which no spec vocabulary defines', () => {
    for (const spelling of ['notIn', 'not_in', 'nin']) {
      expect(mapOperator(spelling)).toBe('nin');
    }
  });

  it('still expands a not-in array into an AND of inequalities', () => {
    // Regression: the expansion keyed on the old spaced spelling.
    expect(normalizeFilterCondition(['stage', 'nin', ['won', 'lost']]))
      .toEqual(['and', ['stage', '!=', 'won'], ['stage', '!=', 'lost']]);
    // …and keeps accepting the spellings an external caller may pass, since
    // normalizeFilterCondition is part of plugin-list's public surface.
    expect(normalizeFilterCondition(['stage', 'not in', ['won', 'lost']]))
      .toEqual(['and', ['stage', '!=', 'won'], ['stage', '!=', 'lost']]);
  });
});
