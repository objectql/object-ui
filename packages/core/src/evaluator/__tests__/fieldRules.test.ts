/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { evalFieldPredicate, resolveFieldRuleState } from '../fieldRules';

describe('evalFieldPredicate', () => {
  it('evaluates a bare-string CEL predicate as TRUE', () => {
    expect(evalFieldPredicate("record.status == 'paid'", { status: 'paid' }, false)).toBe(true);
  });

  it('evaluates a bare-string CEL predicate as FALSE', () => {
    expect(evalFieldPredicate("record.status == 'paid'", { status: 'draft' }, false)).toBe(false);
  });

  it('accepts an { dialect, source } object predicate', () => {
    expect(
      evalFieldPredicate({ dialect: 'cel', source: 'record.amount > 100' }, { amount: 250 }, false),
    ).toBe(true);
  });

  it('returns the fallback for an absent predicate', () => {
    expect(evalFieldPredicate(undefined, { status: 'paid' }, true)).toBe(true);
    expect(evalFieldPredicate(null, { status: 'paid' }, false)).toBe(false);
    expect(evalFieldPredicate('   ', { status: 'paid' }, true)).toBe(true);
  });

  it('fails open to the fallback on a broken predicate', () => {
    // Unparseable / type-faulting CEL must not throw — it returns fallback.
    expect(evalFieldPredicate('record.status ===', { status: 'paid' }, false)).toBe(false);
    expect(evalFieldPredicate('record.status ===', { status: 'paid' }, true)).toBe(true);
  });

  it('fails open when a referenced field is MISSING from the record (CEL "No such key")', () => {
    // CEL throws on a missing map key (vs. comparing cleanly against null). A
    // predicate referencing an absent field must fall back, not surface the
    // fault — the renderer seeds declared fields to null to avoid this, but the
    // helper must be safe on its own.
    expect(evalFieldPredicate("record.status == 'paid'", {}, true)).toBe(true);
    expect(evalFieldPredicate("record.status == 'paid'", {}, false)).toBe(false);
    // Present-but-null compares cleanly to a real boolean (no fault).
    expect(evalFieldPredicate("record.status == 'paid'", { status: null }, true)).toBe(false);
  });

  it('exposes previous.* for transition predicates', () => {
    expect(
      evalFieldPredicate("record.status == 'paid' && previous.status != 'paid'", { status: 'paid' }, false, {
        status: 'sent',
      }),
    ).toBe(true);
  });
});

describe('resolveFieldRuleState', () => {
  it('hides a field whose visibleWhen is FALSE', () => {
    const s = resolveFieldRuleState({ visibleWhen: "record.status == 'sent'" }, { status: 'draft' }, {});
    expect(s.visible).toBe(false);
  });

  it('shows a field whose visibleWhen is TRUE', () => {
    const s = resolveFieldRuleState({ visibleWhen: "record.status == 'sent'" }, { status: 'sent' }, {});
    expect(s.visible).toBe(true);
  });

  it('shows a field with no visibleWhen (default visible)', () => {
    expect(resolveFieldRuleState({}, {}, {}).visible).toBe(true);
  });

  it('locks a field whose readonlyWhen is TRUE', () => {
    const s = resolveFieldRuleState({ readonlyWhen: "record.status == 'paid'" }, { status: 'paid' }, {});
    expect(s.readonly).toBe(true);
  });

  it('keeps a static readonly even when readonlyWhen is FALSE', () => {
    const s = resolveFieldRuleState(
      { readonlyWhen: "record.status == 'paid'" },
      { status: 'draft' },
      { readonly: true },
    );
    expect(s.readonly).toBe(true);
  });

  it('requires a field whose requiredWhen is TRUE', () => {
    const s = resolveFieldRuleState({ requiredWhen: "record.status == 'sent'" }, { status: 'sent' }, {});
    expect(s.required).toBe(true);
  });

  it('honors conditionalRequired as a requiredWhen alias', () => {
    const s = resolveFieldRuleState({ conditionalRequired: "record.status == 'sent'" }, { status: 'sent' }, {});
    expect(s.required).toBe(true);
  });

  it('prefers requiredWhen over conditionalRequired when both present', () => {
    const s = resolveFieldRuleState(
      { requiredWhen: "record.status == 'sent'", conditionalRequired: 'record.amount > 0' },
      { status: 'draft', amount: 5 },
      {},
    );
    // requiredWhen (status=='sent') is FALSE → not required; the alias is ignored.
    expect(s.required).toBe(false);
  });

  it('keeps a static required even when requiredWhen is FALSE', () => {
    const s = resolveFieldRuleState(
      { requiredWhen: "record.status == 'sent'" },
      { status: 'draft' },
      { required: true },
    );
    expect(s.required).toBe(true);
  });

  it('fails open: broken visibleWhen keeps the field visible', () => {
    const s = resolveFieldRuleState({ visibleWhen: 'record.status ===' }, { status: 'x' }, {});
    expect(s.visible).toBe(true);
  });
});
