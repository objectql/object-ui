/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3850 — the ONE definition of "is a predicate gate declared here?",
 * now that it lives in core beside the normalizer it is derived from. The
 * consumer-side pins are
 * `packages/components/src/renderers/action/__tests__/action-empty-predicate-scope.test.tsx`
 * (the action face, through the `hasDeclaredVisibilityGate` re-export),
 * `packages/react/src/__tests__/SchemaRenderer.disabledDeclaredGate.test.tsx`
 * (objectui#3862, the generic rendering path) and
 * `packages/core/src/actions/__tests__/ActionRunner.disabledGate.test.ts` /
 * `.conditionGate.test.ts` (the execution entry, which asked this scope first).
 *
 * ## What this suite pins that the consumers cannot
 *
 * The consumers can only observe the ANSWER through a rendered control. This one
 * pins the scope itself, one shape per case, plus the two structural claims that
 * keep the scope from drifting again:
 *
 *   • DERIVATION: for every shape except the whitespace string,
 *     `hasDeclaredPredicate(x)` is exactly `toPredicateInput(x) !== undefined`.
 *     That equality is the reason this definition is trustworthy — "declared"
 *     means "normalization still leaves something to evaluate", not a hand-rolled
 *     list of empty spellings. A re-spelled predicate that happens to agree on
 *     today's shapes would pass the row cases and fail this one.
 *   • the whitespace string is the single deliberate DIFFERENCE from the
 *     normalizer (which wraps `'   '` into `'${   }'` rather than folding it),
 *     asserted as such so the next reader sees it is chosen, not overlooked.
 *   • the one shape this scope does NOT cover — an envelope whose `source` is
 *     blank but not empty (`{ dialect: 'cel', source: '   ' }`) — is pinned as a
 *     documented residue with the issue that owns it (objectui#3960). It was
 *     found by this suite: the first draft assumed the normalizer folds it, and
 *     that assertion went red. `disabled` still greys out for that spelling, so
 *     it is recorded rather than left for the next reader to rediscover.
 *
 * ## Reverse verification (direction predicted before running)
 *
 * Narrowing the definition back to the renderer's historic scope
 * (`value != null && value !== ''`) must turn RED exactly: the empty-envelope
 * rows (both spellings), the whitespace row, the junk rows, and the derivation
 * case. `''` / `null` / `undefined` / `true` / `false` / every non-empty
 * expression row stays GREEN — they agreed under both scopes, which is why the
 * envelope residue survived objectui#3842 in the first place.
 */

import { describe, it, expect } from 'vitest';
import { hasDeclaredPredicate } from '../declaredPredicate';
import { toPredicateInput } from '../predicateInput';
import { ExpressionEvaluator } from '../ExpressionEvaluator';

/** Every shape the #3850 table measured, plus the boolean verdicts. */
const SHAPES: Array<{ label: string; value: unknown; declared: boolean }> = [
  // ── nothing to evaluate ────────────────────────────────────────────────
  { label: 'undefined (no key)', value: undefined, declared: false },
  { label: 'null', value: null, declared: false },
  { label: "'' (empty predicate)", value: '', declared: false },
  { label: "'   ' (whitespace only)", value: '   ', declared: false },
  { label: "'\\t\\n' (other blanks)", value: '\t\n', declared: false },
  { label: "{ dialect: 'cel', source: '' } (the envelope `objectstack build` emits)", value: { dialect: 'cel', source: '' }, declared: false },
  { label: "{ source: '' } (envelope, no dialect)", value: { source: '' }, declared: false },
  // NOT here: `{ dialect: 'cel', source: '   ' }`. Measured as still DECLARED —
  // objectui#3850's ruling enumerated three empty spellings and the blank-source
  // envelope is a fourth. Pinned as a documented residue below (objectui#3960)
  // rather than silently folded into this table.
  // ── not a predicate at all → fail open, never a reason to disable ──────
  { label: '0', value: 0, declared: false },
  { label: '{} (no source)', value: {}, declared: false },
  { label: '[] (array)', value: [], declared: false },
  { label: '{ dialect: "cel" } (envelope with no source key)', value: { dialect: 'cel' }, declared: false },
  // ── a declared verdict, including the explicit `false` ─────────────────
  { label: 'true', value: true, declared: true },
  { label: 'false (a verdict, not a missing gate — objectui#3812)', value: false, declared: true },
  { label: 'bare CEL expression', value: 'user.role == "admin"', declared: true },
  { label: '`${…}` template', value: '${user.role === "admin"}', declared: true },
  { label: "{ dialect: 'cel', source: 'true' }", value: { dialect: 'cel', source: 'true' }, declared: true },
  { label: "{ dialect: 'template', source: '${x}' }", value: { dialect: 'template', source: '${x}' }, declared: true },
];

describe('hasDeclaredPredicate — the scope objectui#3850 ruled on', () => {
  it.each(SHAPES)('$label → declared=$declared', ({ value, declared }) => {
    expect(hasDeclaredPredicate(value)).toBe(declared);
  });

  it('the three empty spellings the ruling names are one answer, not three', () => {
    // `''` was objectui#3842's half, the envelope objectui#3850's, the
    // whitespace string objectui#3848's. One definition, so they cannot diverge
    // again.
    expect([
      hasDeclaredPredicate(''),
      hasDeclaredPredicate('   '),
      hasDeclaredPredicate({ dialect: 'cel', source: '' }),
    ]).toEqual([false, false, false]);
  });
});

describe('hasDeclaredPredicate is DERIVED from the normalizer, not re-spelled', () => {
  it('agrees with `toPredicateInput(x) !== undefined` on every shape but the whitespace string', () => {
    const disagreements = SHAPES.filter(
      s => hasDeclaredPredicate(s.value) !== (toPredicateInput(s.value) !== undefined),
    ).map(s => s.label);
    expect(disagreements).toEqual([
      "'   ' (whitespace only)",
      "'\\t\\n' (other blanks)",
    ]);
  });

  it('the whitespace string is the one shape the normalizer wraps instead of folding', () => {
    // Which is why the definition names it explicitly. Same blank-source rule
    // `evaluateCondition` (`if (!trimmed) return true`) and `evalRowPredicate`
    // (`listConditional.ts`, `if (!source.trim())`) already apply.
    expect(toPredicateInput('   ')).toBe('${   }');
    expect(toPredicateInput('')).toBeUndefined();
    expect(toPredicateInput({ dialect: 'cel', source: '' })).toBeUndefined();
  });

  it('DOCUMENTED RESIDUE (objectui#3960): a BLANK envelope `source` is still declared', () => {
    // The asymmetry, stated rather than hidden: this definition trims the STRING
    // spelling and does not trim an envelope's `source`, because
    // `toPredicateInput` only folds a source that is `''`:
    expect(toPredicateInput({ dialect: 'cel', source: '   ' })).toEqual({ dialect: 'cel', source: '   ' });
    expect(hasDeclaredPredicate({ dialect: 'cel', source: '   ' })).toBe(true);
    // …while core's own CEL entry calls exactly that value "no predicate":
    const ev = new ExpressionEvaluator({ record: { id: 1 } });
    expect(ev.evaluateCondition({ dialect: 'cel', source: '   ' })).toBe(true);
    // Declared gate + "no condition → true" is the objectui#3850 mechanism with
    // the blank moved inside the envelope, so `disabled` still greys out for this
    // one spelling. objectui#3850's ruling enumerated three empty spellings and
    // this is a fourth, so it is filed (objectui#3960) instead of being widened
    // into the ruled scope here. These expectations are what go RED when it is
    // fixed — the signal to move the shape into the table above.
  });
});

describe('why the question cannot be delegated to the verdict', () => {
  it('evaluateCondition answers `true` for "nothing to evaluate" — which on `disabled` means GREY', () => {
    const ev = new ExpressionEvaluator({ record: { id: 1 } });
    // The inverted default, in four lines. Correct on `visible`/`enabled`,
    // backwards on `disabled` — so every consumer has to ask "declared?" first.
    expect(ev.evaluateCondition(undefined)).toBe(true);
    expect(ev.evaluateCondition('')).toBe(true);
    expect(ev.evaluateCondition('   ')).toBe(true);
    expect(ev.evaluateCondition({ dialect: 'cel', source: '' })).toBe(true);
  });

  it('and truthiness cannot answer it either — `false` is a verdict (objectui#3812)', () => {
    expect(hasDeclaredPredicate(false)).toBe(true);
    const ev = new ExpressionEvaluator({});
    expect(ev.evaluateCondition(false)).toBe(false);
  });
});
