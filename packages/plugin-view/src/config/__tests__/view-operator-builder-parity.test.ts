/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * View operator → FilterBuilder operator parity (#2901, #2945).
 *
 * The third of objectui's spec-operator translation tables. The other two —
 * `ListView.mapOperator` and `data-objectstack`'s `normalizeFilterOperator` —
 * were pinned to the spec in #2974, which found eight spellings they had missed
 * by enumerating instead of deriving. This one maps the same vocabulary onto the
 * FilterBuilder's operator ids, and it had missed nine:
 *
 *   not_equals, greater_than, less_than, greater_than_or_equal,
 *   less_than_or_equal, starts_with, ends_with, is_null, is_not_null
 *
 * All nine are canonical `VIEW_FILTER_OPERATORS` members, so a stored view
 * legitimately carries them, and all nine reached the builder as a raw spelling
 * its dropdown cannot select. Five now map; four are recorded as deliberate
 * gaps, asserted below so the list cannot grow silently.
 */
import { describe, it, expect } from 'vitest';
import { VIEW_FILTER_OPERATORS, VIEW_FILTER_OPERATOR_ALIASES } from '@objectstack/spec/ui';
import { FILTER_BUILDER_OPERATORS } from '@object-ui/components';
import { specToBuilderOperator, __CANONICAL_TO_BUILDER } from '../view-config-utils';

/**
 * Canonical view operators the FilterBuilder cannot express.
 *
 * Empty — every one of the 19 now maps. It was `starts_with`, `ends_with`,
 * `is_null`, `is_not_null` until #2942 gave the builder `startsWith`/`endsWith`/
 * `isNull`/`isNotNull`.
 *
 * Shrink it by adding the operator to the FilterBuilder, never by mapping onto a
 * near-equivalent: `is_null` → `isEmpty` would rewrite a NULL predicate into an
 * empty-string one on the next save.
 */
const NO_BUILDER_EQUIVALENT: string[] = [];

/** Case- and separator-insensitive key, matching the module's own `fold`. */
const fold = (op: string) => op.toLowerCase().replace(/[\s_-]+/g, '');

describe('CANONICAL_TO_BUILDER', () => {
  it('covers every canonical view operator, and nothing else', () => {
    expect(Object.keys(__CANONICAL_TO_BUILDER).sort()).toEqual([...VIEW_FILTER_OPERATORS].sort());
  });

  it('maps onto operator ids the FilterBuilder actually renders', () => {
    const builderIds = new Set(FILTER_BUILDER_OPERATORS);
    const notRenderable = Object.entries(__CANONICAL_TO_BUILDER)
      .filter(([, id]) => id !== null && !builderIds.has(id as never))
      .map(([op, id]) => `${op} -> ${id}`);
    expect(notRenderable).toEqual([]);
  });

  /**
   * The guard that catches drift in the direction the hand-kept gap list could
   * not: the builder GAINING an operator this table still calls unmappable.
   * `starts_with` and `startsWith` fold to the same key, so an unmapped operator
   * whose folded name matches a folded builder id is an omission by definition —
   * which is exactly how #2942's four new operators went unnoticed here.
   */
  it('leaves nothing unmapped that the builder can already draw', () => {
    const byFolded = new Map(FILTER_BUILDER_OPERATORS.map(id => [fold(id), id]));
    const missed = Object.entries(__CANONICAL_TO_BUILDER)
      .filter(([, id]) => id === null)
      .filter(([op]) => byFolded.has(fold(op)))
      .map(([op]) => `${op} -> ${byFolded.get(fold(op))} exists but is unmapped`);
    expect(missed).toEqual([]);
  });

  it('records exactly the documented gaps', () => {
    const unmapped = Object.entries(__CANONICAL_TO_BUILDER)
      .filter(([, id]) => id === null)
      .map(([op]) => op);
    expect(unmapped.sort()).toEqual([...NO_BUILDER_EQUIVALENT].sort());
  });

  it('keeps the NULL and empty-string predicates distinct', () => {
    expect(__CANONICAL_TO_BUILDER.is_null).toBe('isNull');
    expect(__CANONICAL_TO_BUILDER.is_not_null).toBe('isNotNull');
    expect(__CANONICAL_TO_BUILDER.is_empty).toBe('isEmpty');
    expect(__CANONICAL_TO_BUILDER.is_not_empty).toBe('isNotEmpty');
  });
});

describe('specToBuilderOperator', () => {
  it('resolves every canonical view operator that has an equivalent', () => {
    const builderIds = new Set(FILTER_BUILDER_OPERATORS);
    const unresolved = VIEW_FILTER_OPERATORS
      .filter(op => !NO_BUILDER_EQUIVALENT.includes(op))
      .filter(op => !builderIds.has(specToBuilderOperator(op) as never));
    expect(unresolved).toEqual([]);
  });

  it('resolves every legacy alias the spec still folds', () => {
    const builderIds = new Set(FILTER_BUILDER_OPERATORS);
    const unresolved = Object.entries(VIEW_FILTER_OPERATOR_ALIASES)
      .filter(([, canonical]) => !NO_BUILDER_EQUIVALENT.includes(canonical))
      .filter(([alias]) => !builderIds.has(specToBuilderOperator(alias) as never))
      .map(([alias]) => alias);
    expect(unresolved).toEqual([]);
  });

  it('resolves the infix spellings a stored filter array carries', () => {
    expect(specToBuilderOperator('=')).toBe('equals');
    expect(specToBuilderOperator('==')).toBe('equals');
    expect(specToBuilderOperator('!=')).toBe('notEquals');
    expect(specToBuilderOperator('<>')).toBe('notEquals');
    expect(specToBuilderOperator('>')).toBe('greaterThan');
    expect(specToBuilderOperator('<')).toBe('lessThan');
    expect(specToBuilderOperator('>=')).toBe('greaterOrEqual');
    expect(specToBuilderOperator('<=')).toBe('lessOrEqual');
    expect(specToBuilderOperator('nin')).toBe('notIn');
    expect(specToBuilderOperator('like')).toBe('contains');
  });

  it('folds case and separators, so one spelling class is one entry', () => {
    for (const spelling of ['not_in', 'notIn', 'not in', 'NOT_IN', 'not-in', 'notin']) {
      expect(specToBuilderOperator(spelling)).toBe('notIn');
    }
    for (const spelling of ['greater_than_or_equal', 'greaterThanOrEqual', 'greaterorequal']) {
      expect(specToBuilderOperator(spelling)).toBe('greaterOrEqual');
    }
  });

  it('returns an unrecognised operator unchanged rather than coercing it', () => {
    // Visible in the UI as an incomplete condition row beats a silent rewrite
    // to `equals`, which would drop the author's predicate on the next save.
    expect(specToBuilderOperator('totally_made_up')).toBe('totally_made_up');
    expect(specToBuilderOperator('$regex')).toBe('$regex');
  });

  it('resolves the four operators #2942 made expressible', () => {
    expect(specToBuilderOperator('starts_with')).toBe('startsWith');
    expect(specToBuilderOperator('ends_with')).toBe('endsWith');
    expect(specToBuilderOperator('is_null')).toBe('isNull');
    expect(specToBuilderOperator('is_not_null')).toBe('isNotNull');
    // …without collapsing them onto the empty-string pair.
    expect(specToBuilderOperator('is_empty')).toBe('isEmpty');
    expect(specToBuilderOperator('is_not_empty')).toBe('isNotEmpty');
  });

  it('defaults an absent operator to equals', () => {
    expect(specToBuilderOperator('')).toBe('equals');
    expect(specToBuilderOperator(undefined as unknown as string)).toBe('equals');
  });
});
