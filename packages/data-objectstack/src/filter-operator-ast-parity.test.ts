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
 */
const NOT_THIS_ADAPTERS_JOB = new Set(['is_empty', 'is_not_empty']);

describe('FILTER_OPERATOR_ALIASES lands inside the spec AST vocabulary', () => {
  it('reads both vocabularies from the spec', () => {
    expect(VIEW_FILTER_OPERATORS.length).toBeGreaterThan(0);
    expect(VALID_AST_OPERATORS.size).toBeGreaterThan(0);
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
