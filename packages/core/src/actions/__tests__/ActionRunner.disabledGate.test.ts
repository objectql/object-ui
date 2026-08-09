/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3848 — `ActionRunner.execute`'s declared-`disabled` gate. The
 * EXECUTION half of the objectui#3492 family whose renderer halves are
 * objectui#3842 (PR #3851) and objectui#3849 (PR #3861).
 *
 * The gate asked `action.disabled != null && action.disabled !== false`, so every
 * EMPTY predicate got past it and was handed to `evaluateCondition` — which
 * documents exactly one default for "there is no condition here": return `true`,
 * meaning visible/enabled. On `disabled` that `true` means BLOCKED. Measured on
 * `origin/main` @ f0a625aa7 before this change, with a `probe` handler that
 * counts its own calls:
 *
 *   disabled ''                        | handler ran: false | {"success":false,"error":"Action is disabled"}
 *   disabled '   '                     | handler ran: false | {"success":false,"error":"Action is disabled"}
 *   disabled {dialect:'cel',source:''} | handler ran: false | {"success":false,"error":"Action is disabled"}
 *   disabled absent                    | handler ran: true  | {"success":true}
 *   disabled false                     | handler ran: true  | {"success":true}
 *
 * So this was not "the click did nothing" — execution was refused and the caller
 * got an error naming a state the metadata never declared.
 *
 * ## What each row detects
 *
 *   • the three EMPTY shapes (`''`, whitespace-only, empty-`source` envelope) →
 *     the handler must run. THE defect; each is an independent mutation
 *     detector, since the three arrive at "nothing to evaluate" by three
 *     different routes (string identity, `trim()`, envelope `source`).
 *   • `true` / a truthy expression / a truthy CEL envelope → still blocked.
 *     Anti-mutation guards: "never block anything" satisfies most of this table
 *     on its own, and these are what refuse it.
 *   • `false` / absent → still runs (ungated stays ungated), and `false` proves
 *     the gate did not start treating a declared-and-false gate as absent.
 *   • the non-predicate junk rows (`0`, `{}`) → now run. Behaviour change, and
 *     the fail-open direction the file already commits to (`catch { isDisabled
 *     = false }`): a value that is not a predicate at all must not decide that
 *     an action is disabled.
 *
 * ## The parity claim, and the one row it deliberately does NOT make
 *
 * `rendererDisabled` is transcribed from objectui#3848's divergence table (the
 * action face as it stands after #3842 + #3849), NOT recomputed here:
 * `@object-ui/core` is the dependency of the renderer packages, so it cannot
 * import them, and the live renderer-side pins are in those two PRs' tests. The
 * parity test below therefore asserts that the verdicts THIS suite pins equal
 * the verdicts recorded from the renderers — the #3314 invariant (one predicate
 * value, one answer, whichever entry reads it) — for every row where that claim
 * is honest. ONE row is excluded, with its owning issue:
 *
 *   • `{ dialect: 'cel', source: '' }` — the renderer still greys this out
 *     (`hasDeclaredVisibilityGate` is `!= null && !== ''`, which an envelope
 *     passes). That residual is objectui#3850, the queued ruling on how wide
 *     "empty predicate" is across the sites; the execution side pins the
 *     normalized semantics (an envelope with no source is nothing to evaluate).
 *     Not fixed here — objectui#3850 owns the renderer half.
 *
 * The two `${…}`-spelled rows used to be excluded as well, and no longer are.
 * The action-face renderers compose `evaluateCondition(toPredicateInput(x))`,
 * and `toPredicateInput` double-wrapped an already-templated string into
 * `'${${x}}'`, so the renderer verdict was a CONSTANT unrelated to the
 * expression — that is objectui#3871, fixed at the normalizer. The renderer face
 * now reaches the verdicts this suite pins, so both rows claim parity, each
 * backed by a live renderer-side pin rather than transcription alone:
 * `packages/components/src/renderers/action/__tests__/action-template-predicate-gate.test.tsx`
 * (five leaves + two hosts), the `${…}` cases in
 * `packages/app-shell/src/views/__tests__/DeclaredActionsBar.test.tsx`, and
 * `packages/plugin-detail/src/renderers/__tests__/record-quick-actions.template-predicate.test.tsx`.
 * The execution path still reads the RAW value, untouched by that fix — what
 * changed is that normalizing no longer disagrees with it.
 *
 * ## Reverse verification (direction predicted before running)
 *
 * Restoring the old gate (`action.disabled != null && action.disabled !== false`)
 * while leaving evaluation untouched must turn exactly the five
 * nothing-to-evaluate rows RED — `''`, `'   '`, the empty envelope, `0`, `{}` —
 * each naming its own shape, and leave `absent` / `false` / `true` / both
 * expression rows / both non-empty envelope rows GREEN. That is the whole diff:
 * this change can only stop blocking things, never start.
 */

import { describe, it, expect, vi } from 'vitest';
import { ActionRunner, type ActionContext, type ActionDef } from '../ActionRunner';
import { ExpressionEvaluator } from '../../evaluator/ExpressionEvaluator';
import { toPredicateInput } from '../../evaluator/predicateInput';

const CONTEXT: ActionContext = {
  data: { id: 1 },
  record: { id: 1, status: 'active' },
  user: { id: 'u1', role: 'admin' },
};

interface Shape {
  label: string;
  /** Omit the key entirely (the "undeclared" row). */
  absent?: boolean;
  disabled?: unknown;
  /** Execution-side expectation: does the gate refuse to run the handler? */
  blocked: boolean;
  /**
   * The action-face renderer's verdict for the SAME value, transcribed from
   * objectui#3848's table. `null` = parity deliberately not claimed for this
   * row; `divergence` names the issue that owns the difference.
   */
  rendererDisabled: boolean | null;
  divergence?: string;
}

const SHAPES: Shape[] = [
  // ── the defect: nothing to evaluate must not block ───────────────────────
  { label: "disabled: '' (empty predicate)", disabled: '', blocked: false, rendererDisabled: false },
  { label: "disabled: '   ' (whitespace-only predicate)", disabled: '   ', blocked: false, rendererDisabled: false },
  {
    label: "disabled: { dialect: 'cel', source: '' } (empty envelope)",
    disabled: { dialect: 'cel', source: '' },
    blocked: false,
    rendererDisabled: null,
    divergence: 'objectui#3850 — the renderer still reads an empty-source envelope as a declared gate',
  },
  // ── unchanged: ungated stays ungated ────────────────────────────────────
  { label: 'disabled absent (undeclared)', absent: true, blocked: false, rendererDisabled: false },
  { label: 'disabled: false (declared, verdict false)', disabled: false, blocked: false, rendererDisabled: false },
  // ── unchanged: a real gate still blocks ─────────────────────────────────
  { label: 'disabled: true', disabled: true, blocked: true, rendererDisabled: true },
  {
    label: 'disabled: bare CEL that is true',
    disabled: 'user.role == "admin"',
    blocked: true,
    rendererDisabled: true,
  },
  {
    label: 'disabled: bare CEL that is false',
    disabled: 'user.role == "guest"',
    blocked: false,
    rendererDisabled: false,
  },
  {
    label: "disabled: { dialect: 'cel', source: 'true' }",
    disabled: { dialect: 'cel', source: 'true' },
    blocked: true,
    rendererDisabled: true,
  },
  {
    label: "disabled: { dialect: 'cel', source: 'false' }",
    disabled: { dialect: 'cel', source: 'false' },
    blocked: false,
    rendererDisabled: false,
  },
  // Parity claimed since objectui#3871 fixed the normalizer's double wrap; the
  // renderer face now answers by the expression, as this side always did.
  {
    label: 'disabled: legacy template that is true',
    disabled: '${user.role === "admin"}',
    blocked: true,
    rendererDisabled: true,
  },
  {
    label: 'disabled: legacy template that is false',
    disabled: '${user.role === "guest"}',
    blocked: false,
    rendererDisabled: false,
  },
  // ── behaviour change: non-predicate junk fails open ─────────────────────
  { label: 'disabled: 0 (not a predicate)', disabled: 0, blocked: false, rendererDisabled: null, divergence: 'objectui#3850 — the renderers read a non-predicate as a declared gate and coerce it' },
  { label: 'disabled: {} (not a predicate)', disabled: {}, blocked: false, rendererDisabled: null, divergence: 'objectui#3850 — the renderers read a non-predicate as a declared gate and coerce it' },
];

/** Execute one shape and report whether the handler ran. */
async function runShape(shape: Shape) {
  const runner = new ActionRunner(CONTEXT);
  const onClick = vi.fn();
  const action: Record<string, unknown> = { onClick };
  if (!shape.absent) action.disabled = shape.disabled;
  const result = await runner.execute(action as unknown as ActionDef);
  return { result, ran: onClick.mock.calls.length > 0 };
}

describe('ActionRunner.execute — declared `disabled` gate (objectui#3848)', () => {
  it.each(SHAPES)('$label', async (shape) => {
    const { result, ran } = await runShape(shape);
    if (shape.blocked) {
      expect(ran).toBe(false);
      expect(result).toEqual({ success: false, error: 'Action is disabled' });
    } else {
      // The handler RUNNING is the assertion that matters: objectui#3848 was
      // measured by the handler never being invoked, not by a missing toast.
      expect(ran).toBe(true);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('an empty predicate does not even reach the evaluator (the gate decides, not the verdict)', async () => {
    const runner = new ActionRunner(CONTEXT);
    const spy = vi.spyOn(
      runner.getEvaluator() as unknown as { evaluateCondition: (c: unknown) => boolean },
      'evaluateCondition',
    );
    const onClick = vi.fn();
    await runner.execute({ disabled: '', onClick } as unknown as ActionDef);
    expect(onClick).toHaveBeenCalledOnce();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('the execution verdict equals the renderer verdict for every shape where parity is claimed', () => {
    const claimed = SHAPES.filter(s => s.rendererDisabled !== null);
    // Guard the guard: if a future edit nulls out the whole column, this test
    // would pass by asserting nothing. Raised from 8 to 10 when objectui#3871
    // brought the two `${…}` rows into the claim — a floor that does not move
    // with the table is a floor that stops guarding it.
    expect(claimed.length).toBeGreaterThanOrEqual(10);
    for (const shape of claimed) {
      expect(
        shape.blocked,
        `${shape.label}: execution and the action-face renderer must agree (objectui#3314)`,
      ).toBe(shape.rendererDisabled);
    }
  });

  it('records which shapes are knowingly still divergent, and who owns each', () => {
    const divergent = SHAPES.filter(s => s.rendererDisabled === null);
    for (const shape of divergent) {
      expect(shape.divergence, `${shape.label} must name the issue that owns it`).toMatch(/objectui#\d+/);
    }
    // The two `${…}` rows left this list when objectui#3871 was fixed — the
    // renderer face stopped answering with a constant, so there is no longer a
    // difference to own. What remains is one family: the renderer's "is a gate
    // DECLARED?" scope, which objectui#3850 owns for all three shapes.
    expect(divergent.map(s => s.label)).toEqual([
      "disabled: { dialect: 'cel', source: '' } (empty envelope)",
      'disabled: 0 (not a predicate)',
      'disabled: {} (not a predicate)',
    ]);
  });
});

describe('why the gate cannot delegate "is there a condition?" to the verdict (objectui#3848)', () => {
  it('evaluateCondition answers `true` for "no condition" — which on `disabled` means blocked', () => {
    const ev = new ExpressionEvaluator(CONTEXT);
    // The inverted default, in one line. This is the whole mechanism: correct on
    // `visible`/`enabled`, backwards on `disabled`.
    expect(ev.evaluateCondition(undefined)).toBe(true);
    expect(ev.evaluateCondition('')).toBe(true);
    expect(ev.evaluateCondition('   ')).toBe(true);
    expect(ev.evaluateCondition({ dialect: 'cel', source: '' })).toBe(true);
  });

  it('toPredicateInput collapses two of the three empty shapes, and wraps the third', () => {
    // Why the gate is not simply `toPredicateInput(x) !== undefined`: the
    // whitespace string survives normalization as an evaluable-looking template,
    // so the gate names it explicitly (same blank-source rule `evalRowPredicate`
    // applies in `evaluator/listConditional.ts`).
    expect(toPredicateInput('')).toBeUndefined();
    expect(toPredicateInput({ dialect: 'cel', source: '' })).toBeUndefined();
    expect(toPredicateInput('   ')).toBe('${   }');
  });

  it('normalizing a `${…}` predicate now agrees with the raw value (was objectui#3871)', () => {
    // This case replaces the objectui#3871 TRIPWIRE that stood here. The
    // tripwire pinned the defect — `toPredicateInput('${x}')` was `'${${x}}'`,
    // unparseable, returned verbatim, `Boolean(…)` = a constant `true` — and its
    // note said the day it went red was the day to delete it and (only then) let
    // this gate evaluate the normalized value.
    //
    // It went red as predicted (PR for objectui#3871). It is REPLACED rather
    // than deleted, and this gate still reads the raw value, for two reasons:
    //
    //   1. deleting it would leave the repaired property — the normalizer is
    //      idempotent, so normalized and raw reach one verdict — pinned nowhere
    //      near the gate that depends on it. A regression to the old wrap would
    //      then be caught only by the producer-side suite, and the reader here
    //      would have no way to see why "normalize to decide, evaluate the raw
    //      value" is still safe;
    //   2. switching the gate to evaluate the normalized value is a change to
    //      landed objectui#3848 / objectui#3872 semantics with no defect behind
    //      it: raw and normalized now agree on every shape in the table above,
    //      so the switch would be pure churn on the execution path. The
    //      permission its note granted is not an obligation.
    const ev = new ExpressionEvaluator(CONTEXT);
    const falsePredicate = '${user.role === "guest"}';
    expect(ev.evaluateCondition(falsePredicate)).toBe(false);
    expect(toPredicateInput(falsePredicate)).toBe(falsePredicate);
    expect(ev.evaluateCondition(toPredicateInput(falsePredicate) as never)).toBe(false);
    // And the other polarity, which is what the double wrap was hiding on the
    // fail-closed `visible` legs (there it threw rather than reading as true).
    const truePredicate = '${user.role === "admin"}';
    expect(ev.evaluateCondition(truePredicate)).toBe(true);
    expect(ev.evaluateCondition(toPredicateInput(truePredicate) as never)).toBe(true);
  });
});
