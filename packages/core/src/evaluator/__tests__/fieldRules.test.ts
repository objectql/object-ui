/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExpressionEngine } from '@objectstack/formula';
import { evalFieldPredicate, resolveFieldRuleState } from '../fieldRules';

/** Run `fn` with `console.warn` muted (the loud fail-open of #5149 is pinned
 * in its own describe below; these legacy value-contract tests only care about
 * the returned verdicts). */
function muted<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

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
    muted(() => {
      expect(evalFieldPredicate('record.status ===', { status: 'paid' }, false)).toBe(false);
      expect(evalFieldPredicate('record.status ===', { status: 'paid' }, true)).toBe(true);
    });
  });

  it('fails open when a referenced field is MISSING from the record (CEL "No such key")', () => {
    // CEL throws on a missing map key (vs. comparing cleanly against null). A
    // predicate referencing an absent field must fall back, not surface the
    // fault — the renderer seeds declared fields to null to avoid this, but the
    // helper must be safe on its own.
    muted(() => {
      expect(evalFieldPredicate("record.status == 'paid'", {}, true)).toBe(true);
      expect(evalFieldPredicate("record.status == 'paid'", {}, false)).toBe(false);
    });
    // Present-but-null compares cleanly to a real boolean (no fault).
    expect(evalFieldPredicate("record.status == 'paid'", { status: null }, true)).toBe(false);
  });

  it('binds an extra scope (parent.*) for inline line-item cells', () => {
    // A grid cell can reference both its own row and the header via `parent`.
    expect(
      evalFieldPredicate("parent.status == 'paid'", { quantity: 2 }, false, undefined, {
        parent: { status: 'paid' },
      }),
    ).toBe(true);
    expect(
      evalFieldPredicate("parent.status == 'paid' || record.quantity == 0", { quantity: 0 }, false, undefined, {
        parent: { status: 'draft' },
      }),
    ).toBe(true);
    // Without the scope, `parent` is unbound → fault → fallback.
    muted(() => {
      expect(evalFieldPredicate("parent.status == 'paid'", { quantity: 2 }, false)).toBe(false);
    });
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

  // `conditionalRequired` was the pre-protocol-17 alias of `requiredWhen`.
  // @objectstack/spec 17 (#3855) tombstoned it with `retiredKey`, so authoring
  // it is now a `tsc` error AND a hard parse rejection carrying the rename
  // prescription — it can never reach this evaluator from parsed metadata.
  // `requiredWhen` is the only required-predicate slot (AGENTS.md #0.1).
  it('ignores the retired conditionalRequired alias', () => {
    // Deliberately a shape the parameter type no longer permits.
    const legacyRules = { conditionalRequired: "record.status == 'sent'" } as unknown as Parameters<
      typeof resolveFieldRuleState
    >[0];
    const s = resolveFieldRuleState(legacyRules, { status: 'sent' }, {});
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
    const s = muted(() => resolveFieldRuleState({ visibleWhen: 'record.status ===' }, { status: 'x' }, {}));
    expect(s.visible).toBe(true);
  });
});

describe('failure diagnostics — loud fail-open (objectstack#5149, appeal 2)', () => {
  // Every test uses a UNIQUE predicate text: the once-per-predicate dedupe is
  // module-level on purpose (it must survive re-renders), so a text reused
  // across tests would have spent its one warning in the earlier test.
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('warns exactly once for an unbound identifier — with source text, reason, and the applied default', () => {
    const pred = "totally_unbound_5149 == 'x'";
    expect(evalFieldPredicate(pred, { a: 1 }, true)).toBe(true);
    // Re-render / re-evaluation of the same predicate text: no second warning.
    expect(evalFieldPredicate(pred, { a: 1 }, true)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain('failed to evaluate');
    expect(msg).toContain(JSON.stringify(pred)); // the predicate source text
    expect(msg).toContain('Reason: ['); // the engine's failure kind + message
    expect(msg).toContain('(true)'); // which safe default was applied
  });

  it('warns once for a syntax error, and the returned value still tracks the fallback', () => {
    const pred = 'record.amount_5149 >< 3';
    expect(evalFieldPredicate(pred, { amount_5149: 1 }, true)).toBe(true);
    expect(evalFieldPredicate(pred, { amount_5149: 1 }, false)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(JSON.stringify(pred));
  });

  it('does not warn for a healthy, absent, or blank predicate', () => {
    expect(evalFieldPredicate("record.ok_5149 == 'y'", { ok_5149: 'y' }, false)).toBe(true);
    expect(evalFieldPredicate(undefined, {}, true)).toBe(true);
    expect(evalFieldPredicate(null, {}, false)).toBe(false);
    expect(evalFieldPredicate('   ', {}, true)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a genuine FALSE verdict is not a failure and does not warn', () => {
    expect(evalFieldPredicate("record.ok2_5149 == 'y'", { ok2_5149: 'n' }, true)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('`warn: false` suppresses the diagnostic for fault-probing callers', () => {
    const pred = "probe_only_5149 == 'x'";
    expect(evalFieldPredicate(pred, {}, true, undefined, undefined, { warn: false })).toBe(true);
    expect(evalFieldPredicate(pred, {}, false, undefined, undefined, { warn: false })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  // objectui#3792 — the passback that makes `warn: false` cost only the
  // WARNING, not the information. A fault-probing caller silences the built-in
  // line so it can print one labelled line of its own; before this hook that
  // also threw away the engine's description of the failure, which is the part
  // that actually locates the author's typo.
  it('`onFault` hands the engine reason to a caller that silenced the warning', () => {
    const pred = "passback_3792 == 'x'";
    const reasons: string[] = [];
    expect(
      evalFieldPredicate(pred, {}, true, undefined, undefined, {
        warn: false,
        onFault: (r) => reasons.push(r),
      }),
    ).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    // The engine's text verbatim — kind tag, message, and the source excerpt it
    // appends — not a rephrasing built by this layer.
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('[type] Unknown variable: passback_3792');
  });

  it('`onFault` fires per fault — it is not subject to the once-per-predicate dedupe', () => {
    // The built-in warning is deduped module-wide so a re-rendering predicate
    // logs once; the passback must NOT inherit that, or the second caller of a
    // predicate someone else already broke would silently get nothing back.
    const pred = "passback_dedupe_3792 == 'x'";
    const reasons: string[] = [];
    const onFault = (r: string) => reasons.push(r);
    evalFieldPredicate(pred, {}, true, undefined, undefined, { warn: false, onFault });
    evalFieldPredicate(pred, {}, false, undefined, undefined, { warn: false, onFault });
    evalFieldPredicate(pred, {}, true, undefined, undefined, { onFault });
    expect(reasons).toHaveLength(3);
    // …while the warning itself still fires at most once for that text.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(`Reason: ${reasons[2]}`);
  });

  it('`onFault` is not called for a healthy or genuinely false predicate', () => {
    const seen: string[] = [];
    const onFault = (r: string) => seen.push(r);
    expect(
      evalFieldPredicate("record.ok3_3792 == 'y'", { ok3_3792: 'y' }, false, undefined, undefined, { onFault }),
    ).toBe(true);
    expect(
      evalFieldPredicate("record.ok3_3792 == 'y'", { ok3_3792: 'n' }, true, undefined, undefined, { onFault }),
    ).toBe(false);
    expect(evalFieldPredicate(undefined, {}, true, undefined, undefined, { onFault })).toBe(true);
    expect(seen).toEqual([]);
  });

  it('includes the caller-provided context locator', () => {
    const pred = "ctx_unbound_5149 == 'x'";
    evalFieldPredicate(pred, {}, true, undefined, undefined, {
      context: "visibleOn of field 'amount'",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("(visibleOn of field 'amount')");
  });

  it('resolveFieldRuleState reports the rule kind and the field locator', () => {
    const s = resolveFieldRuleState(
      { visibleWhen: 'rule_ctx_5149 ===' },
      { status: 'x' },
      {},
      undefined,
      undefined,
      "field 'amount'",
    );
    // Fail-open default unchanged — #5149 appeal 1 is deliberately NOT here.
    expect(s.visible).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("(visibleWhen of field 'amount')");
  });

  it('warns once when the engine THROWS (defensive catch), tagging the reason as [throw]', () => {
    const spy = vi.spyOn(ExpressionEngine, 'evaluate').mockImplementation(() => {
      throw new Error('engine exploded');
    });
    try {
      expect(evalFieldPredicate('record.throw_5149 == 1', { throw_5149: 1 }, true)).toBe(true);
      expect(evalFieldPredicate('record.throw_5149 == 1', { throw_5149: 1 }, true)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[throw] engine exploded');
  });
});
