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
import { FieldOperatorsSchema } from '@objectstack/spec/data';
import { condToMongo, kvToCondition } from '../FilterConditionField';

/**
 * The `$`-prefixed operator keys of the spec's `FieldOperatorsSchema` —
 * DERIVED from the schema (#2942), so a 16th operator landing in the spec
 * fails the reachability test below instead of drifting unnoticed.
 */
const SPEC_OPERATORS = new Set(
  Object.keys((FieldOperatorsSchema as unknown as { shape?: Record<string, unknown> }).shape ?? {}),
);

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
    'startsWith', 'endsWith', 'isNull', 'isNotNull', 'exists', 'notExists',
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

describe('every spec field operator is reachable from the builder (#2942)', () => {
  it('reads a non-empty operator vocabulary from the spec', () => {
    expect([...SPEC_OPERATORS].length, 'could not read FieldOperatorsSchema.shape').toBeGreaterThan(0);
  });

  it('some builder operator emits every spec $-token', () => {
    const builderOperators = [
      'equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty',
      'greaterThan', 'lessThan', 'greaterOrEqual', 'lessOrEqual', 'in', 'notIn',
      'before', 'after', 'between',
      'startsWith', 'endsWith', 'isNull', 'isNotNull', 'exists', 'notExists',
    ];
    const emitted = new Set<string>();
    for (const operator of builderOperators) {
      const value = operator === 'in' || operator === 'notIn' ? ['a'] : operator === 'between' ? [1, 5] : 'a';
      const frag = condToMongo({ id: 'c1', field: 'f', operator, value } as any, noTypes);
      for (const op of operatorsOf(frag)) emitted.add(op);
    }
    // `$eq` is the spec's IMPLICIT equality form — `equals` deliberately
    // emits the bare `{ field: value }` shape, never an explicit `$eq`.
    // `$between` stays covered by the `$gte`+`$lte` pair `between` emits
    // (kvToCondition reads that pair back as `between`).
    //
    // `$icontains` is a GENUINE GAP, not a modelling nuance, and is excluded
    // here rather than silently dropped from the vocabulary. `FieldOperatorsSchema`
    // gained it between @objectstack/spec 17.0.0-rc.2 and rc.5 (it folds ASCII
    // case, i.e. case-insensitive contains): the server accepts the token, and no
    // builder operator can author it, so the capability is unreachable from the
    // filter UI. Closing it needs a new builder operator with a user-visible
    // label — a new key in all ten locale packs — which is feature work and
    // deliberately NOT carried by the dependency bump that surfaced it
    // (objectui#3560). Tracked as objectui#3567; delete this exclusion when it
    // lands, and the assertion below will hold it honest.
    const KNOWN_UNREACHABLE = new Set(['$eq', '$between', '$icontains']);
    const unreachable = [...SPEC_OPERATORS].filter(
      (op) => !KNOWN_UNREACHABLE.has(op) && !emitted.has(op),
    );
    expect(
      unreachable,
      'FieldOperatorsSchema accepts these but no builder operator can author them',
    ).toEqual([]);
  });

  it('every KNOWN_UNREACHABLE token is still a spec operator (the exclusion ratchet)', () => {
    // A stale exclusion is how a parity test rots into a tautology: if the spec
    // ever drops one of these, the entry must go too rather than sit there
    // excusing a token nobody ships. `$eq` / `$between` / `$icontains` are all
    // real `FieldOperatorsSchema` keys today.
    for (const op of ['$eq', '$between', '$icontains']) {
      expect(SPEC_OPERATORS.has(op), `'${op}' is excluded but no longer a spec operator`).toBe(
        true,
      );
    }
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
    ['startsWith', 'a'],
    ['endsWith', 'a'],
    ['isNull', ''],
    ['isNotNull', ''],
    ['exists', ''],
    ['notExists', ''],
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
