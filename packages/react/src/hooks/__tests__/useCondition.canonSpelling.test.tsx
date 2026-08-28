/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5330 — the row-predicate canon on the `useCondition` TIER.
 *
 * `packages/core`'s `rowPredicateCanon.test.ts` pins the detector and the
 * `evalRowPredicate` tier. This file exists because the two tiers are genuinely
 * separate evaluation entries and a warning wired into only one of them misses
 * the surfaces this card is actually about: the four generic action renderers
 * and `record:alert` go through `usePredicateRecordContext` + `useCondition`,
 * NOT through `evalRowPredicate`. Pinning only the core tier would have left
 * them silent while reading as covered.
 *
 * The legacy-dialect case is the one that would make this warning unshippable
 * if it were wrong: `useCondition`'s own documented example is
 * `'${data.status === "active"}'`, where `data.*` is the CORRECT spelling. A
 * detector that reported it would fire on essentially every legacy predicate in
 * the wild.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetRowPredicateCanonWarnings } from '@object-ui/core';
import { useCondition, usePredicateRecordContext } from '../useExpression';

const row = { status: 'in_review', amount: 10 };

/** Drive the real pairing the action renderers use: bind the row, then evaluate. */
const evaluate = (pred: unknown, record: unknown = row, label?: string) =>
  renderHook(() => {
    const ctx = usePredicateRecordContext(record);
    return useCondition(pred as never, ctx, label ? { label } : undefined);
  }).result.current;

describe('[#5330] useCondition tier — the canon and its deprecation warning', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetRowPredicateCanonWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const deprecationWarnings = (): string[] =>
    warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('DEPRECATED spelling'));

  it('still resolves ALL THREE spellings — no removal before the survey', () => {
    expect(evaluate("record.status == 'in_review'")).toBe(true);
    expect(evaluate("status == 'in_review'")).toBe(true);
    expect(evaluate("data.status == 'in_review'")).toBe(true);
  });

  it('is not vacuous — the same three spellings are false on a non-matching row', () => {
    const other = { status: 'draft', amount: 1 };
    expect(evaluate("record.status == 'in_review'", other)).toBe(false);
    expect(evaluate("status == 'in_review'", other)).toBe(false);
    expect(evaluate("data.status == 'in_review'", other)).toBe(false);
  });

  it('warns once on the bare shorthand, naming the canonical rewrite', () => {
    evaluate("status == 'in_review'", row, 'action:button "approve"');
    const msgs = deprecationWarnings();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('record.status');
    expect(msgs[0]).toContain('action:button "approve"');
  });

  it('warns on a `data.`-rooted CEL predicate', () => {
    evaluate("data.status == 'in_review'");
    expect(deprecationWarnings()).toHaveLength(1);
  });

  it('stays silent on the canonical spelling', () => {
    evaluate("record.status == 'in_review'");
    expect(deprecationWarnings()).toHaveLength(0);
  });

  it('stays silent on a legacy `${…}` predicate, where `data.*` is CORRECT', () => {
    evaluate('${data.status === "in_review"}');
    expect(deprecationWarnings()).toHaveLength(0);
  });

  it('stays silent when there is no row bound (a non-row `useCondition` call)', () => {
    // `usePredicateRecordContext(null)` binds NOTHING, so `record`/`data` are
    // absent and this is not a row predicate at all.
    renderHook(() => useCondition("status == 'in_review'" as never, usePredicateRecordContext(null)));
    expect(deprecationWarnings()).toHaveLength(0);
  });
});
