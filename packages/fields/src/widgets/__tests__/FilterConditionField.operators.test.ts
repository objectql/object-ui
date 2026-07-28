/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Operator spelling guard for the sharing-rule criteria builder (#2901).
 *
 * `condToMongo` emitted `$ncontains` — a token that appears nowhere in
 * `@objectstack/spec` and that objectui's own `convertFiltersToAST` throws on,
 * naming the correct spelling (`$notContains`) in its error message. So every
 * "does not contain" rule authored here validated in the UI and was then
 * rejected downstream. Nothing caught it because the builder's operator list is
 * hand-written and never compared against the spec vocabulary.
 *
 * These tests pin the emitted spellings against `FieldOperatorsSchema`'s keys
 * and pin the round-trip, including the pre-fix spelling that stored criteria
 * still carry.
 */
import { describe, it, expect } from 'vitest';
import { condToMongo, kvToCondition } from '../FilterConditionField';

/** The `$`-prefixed operator keys of the spec's `FieldOperatorsSchema`. */
const SPEC_OPERATORS = new Set([
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
  '$between', '$contains', '$notContains', '$startsWith', '$endsWith',
  '$null', '$exists',
]);

const noTypes = () => undefined;

/** Pull the operator keys out of a `{ field: { $op: v } }` fragment. */
function operatorsOf(frag: Record<string, any> | null): string[] {
  if (!frag) return [];
  return Object.values(frag).flatMap((v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [],
  );
}

describe('condToMongo emits only spec operator spellings', () => {
  const builderOperators = [
    'equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty',
    'greaterThan', 'lessThan', 'greaterOrEqual', 'lessOrEqual', 'in', 'notIn',
    'before', 'after',
  ];

  it.each(builderOperators)('%s emits a spec-defined operator', (operator) => {
    const frag = condToMongo(
      { id: 'c1', field: 'name', operator, value: operator === 'in' || operator === 'notIn' ? ['a'] : 'a' } as any,
      noTypes,
    );
    const unknown = operatorsOf(frag).filter((op) => !SPEC_OPERATORS.has(op));
    expect(unknown, `${operator} emits an operator @objectstack/spec does not define`).toEqual([]);
  });

  it('notContains emits $notContains, not the pre-fix $ncontains', () => {
    const frag = condToMongo({ id: 'c1', field: 'name', operator: 'notContains', value: 'x' } as any, noTypes);
    expect(frag).toEqual({ name: { $notContains: 'x' } });
  });

  it('between emits a range the spec defines', () => {
    const frag = condToMongo({ id: 'c1', field: 'age', operator: 'between', value: [1, 5] } as any, noTypes);
    expect(operatorsOf(frag).every((op) => SPEC_OPERATORS.has(op))).toBe(true);
  });
});

describe('kvToCondition round-trips what condToMongo writes', () => {
  const cases: Array<[string, unknown]> = [
    ['notEquals', 'a'],
    ['contains', 'a'],
    ['notContains', 'a'],
    ['greaterThan', 1],
    ['lessThan', 1],
    ['greaterOrEqual', 1],
    ['lessOrEqual', 1],
  ];

  it.each(cases)('%s survives the round trip', (operator, value) => {
    const frag = condToMongo({ id: 'c1', field: 'f', operator, value } as any, noTypes)!;
    const [[field, v]] = Object.entries(frag);
    expect(kvToCondition(field, v, 0)).toMatchObject({ field: 'f', operator });
  });

  it('still reads the pre-fix $ncontains so stored criteria keep loading', () => {
    // Dropping this would make rules saved before the fix fail to load entirely
    // ("criteria can't be represented") rather than migrate.
    expect(kvToCondition('name', { $ncontains: 'x' }, 0)).toMatchObject({
      field: 'name',
      operator: 'notContains',
      value: 'x',
    });
  });

  it('rejects an operator it cannot represent rather than guessing', () => {
    expect(kvToCondition('name', { $nope: 'x' }, 0)).toBeNull();
  });
});
