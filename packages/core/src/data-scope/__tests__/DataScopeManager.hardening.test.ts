/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The hardening standard for row-level rule evaluation, and the pin that keeps
 * this repository's two evaluators of that kind from diverging a third time.
 *
 * The two divergences already paid for:
 *   - objectui#7378 — this file's `default` arm returned `true`, so an operator
 *     spelling it did not implement admitted every row.
 *   - objectui#7751 — this file read the field off the record unguarded, so a
 *     prototype member name admitted every row, and compared without a type
 *     guard, so `null` and `'10'` satisfied a numeric rule.
 *
 * Both were found by comparing against `evaluateCondition` in
 * `@object-ui/permissions`, and both were the same failure direction: ADMIT,
 * silently, on a permission boundary. So the standard is written here as a
 * shared table rather than as prose, and the last describe block runs it
 * against BOTH evaluators.
 *
 * ⛔ What this file deliberately takes no position on: operator SPELLING.
 * `ne`/`nin` here, `neq`/`not_in` there, and the sibling's `is_null` /
 * `is_not_null` which this evaluator does not implement. That divergence is
 * objectui#7750's question and it is in the decision box. The conformance
 * table below therefore addresses each evaluator in its own spelling through
 * an explicit map, rather than asserting either vocabulary is the right one.
 */

import { describe, it, expect } from 'vitest';
import { DataScopeManager, type RowLevelFilter } from '../DataScopeManager';
// Cross-package relative import, on purpose: `evaluateCondition` is NOT part of
// `@object-ui/permissions`' public entry (its `index.ts` exports
// `evaluatePermission` only), so there is no bare specifier that reaches it,
// and a conformance table that cannot see the other evaluator cannot pin
// anything. Same shape as the two existing cross-package test imports on main
// (`activityItemType-6730.test.ts`, `degradeSetTwin-5880.test.ts`).
import { evaluateCondition } from '../../../../permissions/src/evaluator';
import type { PermissionCondition } from '@object-ui/types';

/**
 * A rule as it arrives from STORED JSON — the path that matters, because
 * `RowLevelFilter['operator']` is a closed union that protects TypeScript call
 * sites and nothing else, and `field` is a bare `string` that no type narrows.
 */
const storedRule = (field: string, operator: string, value: unknown): RowLevelFilter =>
  ({ field, operator, value }) as unknown as RowLevelFilter;

/** Does this rule admit this row? One row in, one verdict out. */
function admits(field: string, operator: string, value: unknown, row: unknown): boolean {
  const manager = new DataScopeManager();
  manager.registerScope('t', { data: [] });
  manager.setFilters('t', [storedRule(field, operator, value)]);
  return manager.applyFilters('t', [row]).length === 1;
}

describe('DataScopeManager hardening — field reads (objectui#7751 gap 1)', () => {
  const row = { id: 1, tenant: 'acme' };

  it('refuses the rule the card was filed for: a `constructor` name no longer admits every row', () => {
    // Measured on the pre-fix source: this returned the ENTIRE dataset. The
    // name reached `Object.prototype.constructor`, `Function !== 'x'` is true,
    // and every row passed the rule that existed to hide it.
    expect(admits('constructor', 'ne', 'x', row)).toBe(false);
    expect(admits('constructor', 'ne', 'x', 1)).toBe(false);
  });

  // The class, not three spellings of it. A name list enumerates; the prototype
  // chain has more members than any list holds, and each one that is not on the
  // list reads as an absent field, which ADMITS on a negative operator. This is
  // the gap the sibling still has (objectui#8044) and the reason this evaluator
  // distinguishes "inherited" from "absent" instead of copying its read.
  it.each([
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ])('denies rather than admits for the prototype member name %s', (field) => {
    expect(admits(field, 'ne', 'x', row)).toBe(false);
    expect(admits(field, 'nin', ['x'], row)).toBe(false);
    expect(admits(field, 'eq', 'x', row)).toBe(false);
    expect(admits(field, 'in', ['x'], row)).toBe(false);
    expect(admits(field, 'contains', 'x', row)).toBe(false);
    expect(admits(field, 'gte', 0, row)).toBe(false);
  });

  it('reads a value the record inherits as NOT the record\'s data', () => {
    const inherited = () => Object.assign(Object.create({ tenant: 'acme' }), { id: 1 });
    // The record's tenant IS `acme` — through its prototype. Admitting it under
    // "tenant is not acme" is the fail-open; denying under "tenant is acme" is
    // the narrowing that buys it. Both verdicts are the refusal, not a compare.
    expect(admits('tenant', 'eq', 'acme', inherited())).toBe(false);
    expect(admits('tenant', 'ne', 'other', inherited())).toBe(false);
  });

  // The regression THIS fix is most likely to cause, pinned against itself.
  // "Field not set on this row" is ordinary, legitimate data — not an attack —
  // and its verdicts must be exactly what they have always been. Measured: of
  // 2772 differential cases, the genuinely-absent family changed zero verdicts.
  it('leaves a genuinely absent field with the verdicts it has always had', () => {
    const noSuchName = { id: 1 };
    expect(admits('status', 'ne', 'archived', noSuchName)).toBe(true);
    expect(admits('status', 'nin', ['archived'], noSuchName)).toBe(true);
    expect(admits('status', 'eq', 'archived', noSuchName)).toBe(false);
    expect(admits('status', 'in', ['archived'], noSuchName)).toBe(false);
    expect(admits('status', 'contains', 'arch', noSuchName)).toBe(false);
  });

  it('reads own members off a null-prototype record unchanged', () => {
    const bare = Object.create(null);
    bare.tenant = 'acme';
    expect(admits('tenant', 'eq', 'acme', bare)).toBe(true);
    expect(admits('tenant', 'ne', 'acme', bare)).toBe(false);
  });
});

describe('DataScopeManager hardening — comparisons (objectui#7751 gap 2)', () => {
  it('refuses the two coercions the card was filed for', () => {
    // Measured on the pre-fix source: both admitted. `null >= 0` is `0 >= 0`;
    // `'10' >= 0` is `10 >= 0`. Neither coercion is anything the rule's author
    // wrote, and both widen a rule meant to select numbers.
    expect(admits('age', 'gte', 0, { age: null })).toBe(false);
    expect(admits('age', 'gte', 0, { age: '10' })).toBe(false);
  });

  it.each([
    ['null', null],
    ['a boolean', true],
    ['a false boolean', false],
    ['an empty string', ''],
    ['a numeric string', '10'],
    ['an empty array', []],
    ['a single-element array', [10]],
  ])('denies a numeric rule for %s on the record side', (_label, fieldValue) => {
    expect(admits('age', 'gte', 0, { age: fieldValue })).toBe(false);
    expect(admits('age', 'lte', 0, { age: fieldValue })).toBe(false);
  });

  it('denies a numeric record value against a non-numeric rule value', () => {
    expect(admits('age', 'gte', '10', { age: 30 })).toBe(false);
    expect(admits('age', 'gte', null, { age: 30 })).toBe(false);
    expect(admits('age', 'gte', true, { age: 30 })).toBe(false);
  });

  // The reason this evaluator does NOT copy the sibling's `typeof === 'number'`
  // on both sides. These three orderings work on this evaluator today, none of
  // them coerces anything, and the sibling's predicate denies every row for all
  // three (measured). Same KIND is the property; "both numbers" is a different,
  // stricter rule that costs real rules and buys no safety.
  it('keeps ordered comparisons that do not coerce: ISO date strings', () => {
    expect(admits('created', 'gte', '2023-01-01', { created: '2024-06-01' })).toBe(true);
    expect(admits('created', 'gte', '2023-01-01', { created: '2022-01-01' })).toBe(false);
  });

  it('keeps ordered comparisons that do not coerce: string ranges', () => {
    expect(admits('name', 'gte', 'b', { name: 'zoe' })).toBe(true);
    expect(admits('name', 'gte', 'b', { name: 'alice' })).toBe(false);
  });

  it('keeps ordered comparisons that do not coerce: Date objects', () => {
    expect(admits('at', 'gte', new Date('2023-01-01'), { at: new Date('2024-01-01') })).toBe(true);
    expect(admits('at', 'gte', new Date('2023-01-01'), { at: new Date('2020-01-01') })).toBe(false);
  });

  it('keeps numbers comparing as numbers', () => {
    expect(admits('age', 'gte', 18, { age: 30 })).toBe(true);
    expect(admits('age', 'gte', 18, { age: 17 })).toBe(false);
    expect(admits('age', 'gt', 0, { age: Infinity })).toBe(true);
    expect(admits('age', 'gte', 0, { age: NaN })).toBe(false);
  });

  it('requires the `contains` rule value to BE a string rather than become one', () => {
    // `String(filterValue)` made a numeric rule value match a numeric string
    // record value — the same unwritten coercion as the ordered arms, and the
    // sibling already refused it.
    expect(admits('code', 'contains', 1, { code: '10' })).toBe(false);
    expect(admits('code', 'contains', '1', { code: '10' })).toBe(true);
  });

  it('leaves the non-ordering operators alone — they never coerced', () => {
    // `===`, `!==` and `includes` (SameValueZero) do not coerce, so no guard is
    // added to them and no verdict moves. Pinned so a later "consistency" pass
    // does not narrow them on the strength of the arms above.
    expect(admits('age', 'eq', 0, { age: null })).toBe(false);
    expect(admits('age', 'ne', 0, { age: null })).toBe(true);
    expect(admits('age', 'in', [10], { age: '10' })).toBe(false);
    expect(admits('age', 'in', ['10'], { age: '10' })).toBe(true);
  });
});

/**
 * The anti-divergence pin.
 *
 * One table, both evaluators, each addressed in its own operator spelling. A
 * case listed here is a HARDENING case: a rule that names something which is
 * not the record's data, or compares two values of different kinds. Every one
 * of them must DENY in both evaluators, and a future change that reopens one
 * of them in either evaluator turns this red — which is the whole point, since
 * both previous divergences were found by hand and only after they shipped.
 */
describe('cross-evaluator conformance — both evaluators refuse the same rules', () => {
  const record = { id: 1, tenant: 'acme', age: 30 };

  /** Spelling map. Its existence is objectui#7750's question, not this pin's. */
  const NEGATIVE_EQ = { core: 'ne', sibling: 'neq' } as const;

  const sibling = (field: string, operator: string, value: unknown, row: Record<string, unknown>) =>
    evaluateCondition({ field, operator, value } as unknown as PermissionCondition, row);

  it.each([
    ['a `__proto__` field name', '__proto__', NEGATIVE_EQ, 'x'],
    ['a `constructor` field name', 'constructor', NEGATIVE_EQ, 'x'],
    ['a `prototype` field name', 'prototype', NEGATIVE_EQ, 'x'],
  ])('%s is refused by both', (_label, field, ops, value) => {
    expect(admits(field, ops.core, value, record)).toBe(false);
    expect(sibling(field, ops.sibling, value, record)).toBe(false);
  });

  it.each([
    ['null against a number', 'age', null],
    ['a numeric string against a number', 'age', '10'],
    ['a boolean against a number', 'age', true],
    ['an array against a number', 'age', []],
  ])('a coercing ordered comparison — %s — is refused by both', (_label, field, fieldValue) => {
    const row = { ...record, [field]: fieldValue };
    expect(admits(field, 'gte', 0, row)).toBe(false);
    expect(sibling(field, 'gte', 0, row)).toBe(false);
  });

  it('a `contains` rule with a non-string value is refused by both', () => {
    const row = { ...record, code: '10' };
    expect(admits('code', 'contains', 1, row)).toBe(false);
    expect(sibling('code', 'contains', 1, row)).toBe(false);
  });

  it('an unimplemented operator spelling denies rather than admits in both', () => {
    expect(admits('tenant', 'no_such_operator', 'acme', record)).toBe(false);
    expect(sibling('tenant', 'no_such_operator', 'acme', record)).toBe(false);
  });

  /**
   * Where the two evaluators are NOT yet equal, asserted rather than left to be
   * rediscovered. Both rows below are the sibling's open gap objectui#8044:
   * its guard is a three-name list plus a `hasOwnProperty` read, which
   * collapses "inherited" into "absent", and absent ADMITS on a negative
   * operator. `DataScopeManager` distinguishes the two and denies.
   *
   * ⚠️ When objectui#8044 lands, these expectations FLIP to `false` and this
   * block folds into the table above. It is written as an assertion, not a
   * comment, so that fixing the sibling turns this red and tells the
   * implementer where the standard is recorded. ⛔ Do not "fix" a red here by
   * loosening `DataScopeManager` to match.
   */
  it.each([
    ['toString'],
    ['valueOf'],
    ['hasOwnProperty'],
  ])('KNOWN GAP objectui#8044 — the sibling still admits the prototype member name %s', (field) => {
    expect(admits(field, NEGATIVE_EQ.core, 'x', record)).toBe(false);
    expect(sibling(field, NEGATIVE_EQ.sibling, 'x', record)).toBe(true);
  });

  it('KNOWN GAP objectui#8044 — the sibling admits an inherited value under a negative rule', () => {
    const inherited = Object.assign(Object.create({ tenant: 'acme' }), { id: 1 }) as Record<string, unknown>;
    expect(admits('tenant', NEGATIVE_EQ.core, 'acme', inherited)).toBe(false);
    expect(sibling('tenant', NEGATIVE_EQ.sibling, 'acme', inherited)).toBe(true);
  });

  /**
   * The reverse direction, also asserted: where `DataScopeManager` is
   * deliberately BROADER than the sibling. The sibling requires
   * `typeof === 'number'` on both sides of every ordered comparison, so it
   * denies ISO date strings, string ranges and `Date` objects — none of which
   * coerce. Copying its predicate here would have denied every row for those
   * rules. Pinned so the difference reads as a decision with a reason rather
   * than as the next divergence.
   */
  it('DELIBERATE DIVERGENCE — same-kind non-numeric ordering works here, not in the sibling', () => {
    const row = { created: '2024-06-01' };
    expect(admits('created', 'gte', '2023-01-01', row)).toBe(true);
    expect(sibling('created', 'gte', '2023-01-01', row)).toBe(false);
  });
});
