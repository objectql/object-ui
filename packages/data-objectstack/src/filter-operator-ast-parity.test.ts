/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Adapter operator table → filter-AST parity (#2901, objectstack#3948).
 *
 * `FILTER_OPERATOR_ALIASES` is the last translation a filter passes through
 * before it goes on the wire, and `normalizeFilterOperator` ends in `?? op` —
 * an unmapped operator is emitted verbatim. The server then rejects the shape
 * at `isFilterAST()`, passes the array through unconverted, and driver-sql
 * skips it entirely: **no WHERE clause, no error, every row returned.**
 *
 * So a missing row in this table is not a validation failure, it is an
 * unfiltered query. `before`/`after` — canonical members of the spec's
 * `VIEW_FILTER_OPERATORS` — were missing, which is exactly how a stored
 * "close_date before X" view came back unfiltered.
 *
 * These tests pin the table against the spec vocabularies in both directions.
 */
import { describe, it, expect } from 'vitest';
import { VALID_AST_OPERATORS } from '@objectstack/spec/data';
import { VIEW_FILTER_OPERATORS } from '@objectstack/spec/ui';
import { FILTER_OPERATOR_ALIASES } from './index';

/**
 * View operators this adapter is not the bridge for — the value-shape ones the
 * view layer resolves to a null comparison before an operator is ever emitted.
 *
 * Every token here must still be a member of `VIEW_FILTER_OPERATORS` — the
 * ratchet below enforces it. Subtracting a name the spec has retired excuses
 * nothing and must be deleted rather than left as a dead subtraction (#3628).
 */
const NOT_THIS_ADAPTERS_JOB = new Set(['is_empty', 'is_not_empty']);

describe('FILTER_OPERATOR_ALIASES lands inside the spec AST vocabulary', () => {
  it('reads both vocabularies from the spec', () => {
    expect(VIEW_FILTER_OPERATORS.length).toBeGreaterThan(0);
    expect(VALID_AST_OPERATORS.size).toBeGreaterThan(0);
  });

  // The exclusion ratchet (#3628). The coverage sweep further down subtracts a
  // hand-written set from a spec-derived vocabulary, and that subtraction only
  // excuses something while the spec still lists the subtracted tokens. Once
  // upstream retires or renames one, the sweep stays green (it is still total
  // over what remains) but the row becomes dead weight, and its comment goes on
  // telling the next reader that the view layer resolves this one to a null
  // comparison — about an operator no author can declare any more. That is the
  // shape that rotted 37 of 82 deny-list entries in #3601 with nothing to report
  // it: a hand-written list beside a spec-derived vocabulary and no assertion
  // that its members still exist in that vocabulary.
  //
  // Collected rather than asserted per entry on purpose (same call as PR #3623):
  // vocabulary retirements land as whole families, and failing on the first entry
  // would hide the rest.
  it('every NOT_THIS_ADAPTERS_JOB token is still in the spec view vocabulary', () => {
    const vocabulary = new Set<string>(VIEW_FILTER_OPERATORS);
    const retired = [...NOT_THIS_ADAPTERS_JOB].filter((op) => !vocabulary.has(op));
    expect(
      retired,
      `VIEW_FILTER_OPERATORS no longer lists these NOT_THIS_ADAPTERS_JOB tokens: `
        + `${retired.join(', ')}. The spec has retired them, so subtracting them from `
        + 'the coverage sweep below excuses nothing — delete each from the set (with '
        + 'the comment claiming the view layer resolves it) rather than leaving a dead '
        + 'subtraction',
    ).toEqual([]);
  });

  it('every alias target is an operator the AST gate accepts', () => {
    const bad = Object.entries(FILTER_OPERATOR_ALIASES)
      .filter(([, target]) => !VALID_AST_OPERATORS.has(String(target).toLowerCase()))
      .map(([alias, target]) => `${alias} → ${target}`);
    expect(
      bad,
      'these aliases translate to operators VALID_AST_OPERATORS rejects, so the '
        + 'server drops the filter silently instead of erroring',
    ).toEqual([]);
  });

  it('covers every canonical view operator the spec defines', () => {
    const uncovered = VIEW_FILTER_OPERATORS
      .filter((op) => !NOT_THIS_ADAPTERS_JOB.has(op))
      .filter((op) => {
        const target = FILTER_OPERATOR_ALIASES[op] ?? op;
        return !VALID_AST_OPERATORS.has(String(target).toLowerCase());
      });
    expect(
      uncovered,
      'an author can declare these on a ViewFilterRule and the spec validates them, '
        + 'but they reach the wire unmapped and the filter is silently dropped',
    ).toEqual([]);
  });

  it('maps the date comparisons that regressed', () => {
    expect(FILTER_OPERATOR_ALIASES.before).toBe('<');
    expect(FILTER_OPERATOR_ALIASES.after).toBe('>');
  });
});
