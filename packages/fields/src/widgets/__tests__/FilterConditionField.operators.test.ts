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
import { FILTER_BUILDER_OPERATORS, operatorsForFieldType } from '@object-ui/components';
import {
  condToMongo,
  kvToCondition,
  FILTER_CONDITION_EXTRA_OPERATORS,
} from '../FilterConditionField';

/**
 * The `$`-prefixed operator keys of the spec's `FieldOperatorsSchema` —
 * DERIVED from the schema (#2942), so a 16th operator landing in the spec
 * fails the reachability test below instead of drifting unnoticed.
 */
const SPEC_OPERATORS = new Set(
  Object.keys((FieldOperatorsSchema as unknown as { shape?: Record<string, unknown> }).shape ?? {}),
);

const noTypes = () => undefined;

/**
 * Spec `$`-tokens no builder operator emits, each for a stated reason.
 *
 * Module scope, and the ONE list — the ratchet below reads this same Set rather
 * than restating its members. Two copies is how an exclusion outlives its
 * reason: removing `$icontains` from a hand-repeated ratchet list is a separate
 * edit nothing forces, so the ratchet would have gone on vouching for an entry
 * the parity assertion no longer holds (objectui#4023).
 *
 * `$eq` is the spec's IMPLICIT equality form — `equals` deliberately emits the
 * bare `{ field: value }` shape, never an explicit `$eq`. `$between` stays
 * covered by the `$gte`+`$lte` pair `between` emits (kvToCondition reads that
 * pair back as `between`).
 *
 * `$icontains` was here from objectui#3560 until objectui#4023: the spec gained
 * it between @objectstack/spec 17.0.0-rc.2 and rc.5, and no builder operator
 * could author it. `containsCaseInsensitive` now does, so the entry is gone and
 * the parity assertion below is what holds that honest.
 *
 * `$like` and `$ilike` arrived with the `@objectstack/spec` 17.0.0 GA pin
 * (objectui#4636), and their entry here is a DECISION, not an open question:
 * objectui#4911, maintainer-ruled B on 2026-08-17 — this visual builder
 * deliberately does not offer raw pattern-matching authoring. The constrained
 * intents are the authorable surface and already reach the dropdown (`contains`
 * / `containsCaseInsensitive` / `startsWith` / `endsWith`), so what a `$like`
 * row would add on top of them is exactly the raw `%`/`_` wildcard form — the
 * one operator where a mis-authored value silently returns the wrong rows
 * instead of erroring, which is an error bed in an end-user filter UI, and for
 * zero measured author pull.
 *
 * This is a BUILDER-surface refusal, not a capability removal: the API surface
 * is unaffected and `FieldOperatorsSchema` goes on accepting both operators for
 * hand-written ObjectQL, direct JSON authors and integrations. That is what
 * makes the exclusion honest rather than a gap papered over — the tokens stay
 * reachable, just not from this dropdown.
 *
 * Reopen condition, named by the ruling: a real user or deployment asks to
 * author wildcard patterns in the UI. If that happens, reopen objectui#4911,
 * delete these two members and add the builder operators that author them; the
 * parity assertion below then holds that honest, exactly as it did when
 * objectui#4023 retired `$icontains`.
 *
 * Nothing mechanical can hold that condition for you — the ratchet below checks
 * only that a member is still a spec operator, never that its reason is still
 * the true one. A refusal that outlives its rationale is the stale-exclusion rot
 * this comment block warns about one level up, and a reader is what catches it,
 * not a run.
 */
const KNOWN_UNREACHABLE = new Set(['$eq', '$between', '$like', '$ilike']);

/** Pull the operator keys out of a `{ field: { $op: v } }` fragment. */
function operatorsOf(frag: Record<string, any> | null): string[] {
  if (!frag) return [];
  return Object.values(frag).flatMap((v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [],
  );
}

describe('condToMongo emits only spec operator spellings', () => {
  const builderOperators = [
    'equals', 'notEquals', 'contains', 'containsCaseInsensitive', 'notContains',
    'isEmpty', 'isNotEmpty',
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

  it('containsCaseInsensitive emits $icontains, and contains still emits $contains', () => {
    // The pair, in one assertion: objectui#4023's recorded default is a NEW
    // operator, so `contains` keeping its case-SENSITIVE spelling is half of
    // what shipped. Flipping it would silently change every stored filter view.
    expect(
      condToMongo({ id: 'c1', field: 'name', operator: 'containsCaseInsensitive', value: 'acme' } as any, noTypes),
    ).toEqual({ name: { $icontains: 'acme' } });
    expect(
      condToMongo({ id: 'c2', field: 'name', operator: 'contains', value: 'acme' } as any, noTypes),
    ).toEqual({ name: { $contains: 'acme' } });
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
    // Every id the dropdown can draw, opt-in ones included — DERIVED, so a
    // builder operator that `condToMongo` forgot cannot quietly leave this
    // sweep and take a spec token's only route to the UI with it.
    const emitted = new Set<string>();
    for (const operator of FILTER_BUILDER_OPERATORS) {
      const value = operator === 'in' || operator === 'notIn' ? ['a'] : operator === 'between' ? [1, 5] : 'a';
      const frag = condToMongo({ id: 'c1', field: 'f', operator, value } as any, noTypes);
      for (const op of operatorsOf(frag)) emitted.add(op);
    }
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
    // excusing a token nobody ships. `$eq` / `$between` are real
    // `FieldOperatorsSchema` keys today.
    for (const op of KNOWN_UNREACHABLE) {
      expect(SPEC_OPERATORS.has(op), `'${op}' is excluded but no longer a spec operator`).toBe(
        true,
      );
    }
  });

  /**
   * Emitting the token is only half of "reachable from the filter UI" — the
   * other half is a dropdown row an admin can actually click. `condToMongo`
   * answers to any string it is handed, so a spec token whose only builder
   * operator was never added to the vocabulary would pass the sweep above and
   * still be unauthorable, which is precisely the state objectui#4023 found.
   */
  it('the $icontains operator is one the builder can draw, and this widget offers it', () => {
    expect(FILTER_BUILDER_OPERATORS).toContain('containsCaseInsensitive');
    expect(FILTER_CONDITION_EXTRA_OPERATORS).toContain('containsCaseInsensitive');
    // Every opt-in this widget asks for must be an id the dropdown knows;
    // a typo here is a row that never renders and never fails anything else.
    for (const id of FILTER_CONDITION_EXTRA_OPERATORS) {
      expect(FILTER_BUILDER_OPERATORS, `${id} is not a FilterBuilder operator id`).toContain(id);
    }
    // …and it reaches a text field's dropdown once this widget opts in.
    const offered = operatorsForFieldType('text', FILTER_CONDITION_EXTRA_OPERATORS).map((o) => o.value);
    expect(offered).toContain('containsCaseInsensitive');
    expect(offered).toContain('contains');
  });

  /**
   * The same half for `$exists` (objectui#4736). The pair became opt-in when the
   * list and view surfaces — whose dialects have no existence operator — were
   * found offering it, so THIS widget naming it is now the only thing keeping
   * `$exists` authorable at all.
   *
   * The sweep above cannot notice if that opt-in is dropped: it feeds
   * `FILTER_BUILDER_OPERATORS` (every DRAWABLE id) straight to `condToMongo`,
   * which answers to any string it is handed, so `$exists` would still count as
   * emitted while no admin could click a row that emits it — exactly the state
   * objectui#4023 found for `$icontains`.
   */
  it('the $exists operator is one this widget still offers, post-withdrawal', () => {
    expect(SPEC_OPERATORS.has('$exists'), '$exists is no longer a spec operator').toBe(true);
    expect(FILTER_BUILDER_OPERATORS).toContain('exists');
    expect(FILTER_BUILDER_OPERATORS).toContain('notExists');
    expect(FILTER_CONDITION_EXTRA_OPERATORS).toContain('exists');
    expect(FILTER_CONDITION_EXTRA_OPERATORS).toContain('notExists');

    for (const type of ['text', 'number', 'date', 'select', 'lookup']) {
      const offered = operatorsForFieldType(type, FILTER_CONDITION_EXTRA_OPERATORS)
        .map((o) => o.value);
      expect(offered, `${type} lost the existence pair`).toContain('exists');
      expect(offered, `${type} lost the existence pair`).toContain('notExists');
      // Distinct rows from the null predicates, which author `$null`. The two
      // are different spec operators and `condToMongo` keeps them apart.
      expect(offered, type).toContain('isNull');
      expect(offered, type).toContain('isNotNull');
    }
  });
});

describe('kvToCondition round-trips what condToMongo writes', () => {
  const cases: Array<[string, unknown]> = [
    ['notEquals', 'a'],
    ['contains', 'a'],
    // objectui#4023 deliverable 2: a saved filter view must not degrade on
    // reopen. Without the `$icontains` arm in kvToCondition, criteria this very
    // builder wrote comes back "not representable" and forces the JSON editor.
    ['containsCaseInsensitive', 'a'],
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
