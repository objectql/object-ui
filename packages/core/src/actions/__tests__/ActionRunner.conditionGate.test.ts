/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3872 — `ActionRunner.execute`'s declared-`condition` gate. The
 * neighbour-line sibling of objectui#3848 (PR #3873, the `disabled` gate), and
 * the OVER-PERMISSIVE half of the objectui#3492 family.
 *
 * The gate asked `if (action.condition)`, i.e. "is the raw value truthy?", which
 * cannot answer "did the author declare a gate?". `condition: false` — the most
 * explicit "never execute" metadata can carry, and what a template that switches
 * an action off emits — landed on `if (false)`, so `evaluateCondition` was never
 * consulted and the action RAN. Measured on `origin/main` @ `2937bcf7d` before
 * this change, with a `probe` handler that counts its own calls:
 *
 *   condition: false                      | handler ran: true  | {"success":true}
 *   condition: 0                          | handler ran: true  | {"success":true}
 *   condition: {cel,'false'}              | handler ran: false | {"error":"Action condition not met"}
 *   condition: bare CEL false             | handler ran: false | {"error":"Action condition not met"}
 *   condition: '' / '   ' / {cel,''} / {} | handler ran: true  | {"success":true}
 *
 * So `false` and the semantically IDENTICAL `{ dialect: 'cel', source: 'false' }`
 * reached opposite conclusions: the boolean literal executed, its envelope
 * spelling was refused. Direction of the defect is over-permission — the action
 * really ran, possibly writing — which is the more dangerous side of the family
 * than objectui#3848's over-blocking.
 *
 * ## What each row detects
 *
 *   • `false` → must now BLOCK. THE defect, and the only row whose behaviour
 *     this change alters.
 *   • `true` / a truthy expression / a truthy CEL envelope / absent → still
 *     runs. Anti-mutation guards: "block whenever the key is present" satisfies
 *     the `false` row on its own, and these refuse it.
 *   • a falsy expression / a falsy CEL envelope / a falsy `${…}` template →
 *     still blocked, unchanged. These are what a correct `condition` already
 *     did, and the gate must not lose them while learning about `false`.
 *   • the three EMPTY shapes (`''`, whitespace-only, empty-`source` envelope) →
 *     still run, now because objectui#3850's ruling says nothing was declared
 *     rather than because `if ('')` happened to be falsy. Same verdict, sound
 *     reason; each arrives at "nothing to evaluate" by a different route
 *     (string identity, `trim()`, envelope `source`), so each is its own
 *     mutation detector.
 *   • the non-predicate junk rows (`0`, `{}`) → still run, and NOT because the
 *     old truthiness test skipped them. See the divergence test below: this is
 *     a deliberate departure from `ActionEngine.getActionsForLocation`'s
 *     `Boolean(raw)` junk branch, which would have `0` block here.
 *
 * ## Scope: what this change does NOT touch
 *
 * The `disabled` gate below it (objectui#3848 / PR #3873) keeps its semantics
 * and its message verbatim; `ActionRunner.disabledGate.test.ts` is its pin and
 * is unchanged by this PR. The only shared edit is the module-private
 * declaredness helper's key-neutral NAME, now that two gates ask it.
 *
 * ## Reverse verification (direction predicted before running)
 *
 * Restoring the truthy gate (`if (action.condition)`) while leaving evaluation
 * untouched must turn exactly THREE tests RED, every one of them naming `false`:
 *
 *   1. the `condition: false` row — the handler runs again, so `blocked` fails;
 *   2. the boolean/envelope equivalence test — `false` runs while
 *      `{ dialect: 'cel', source: 'false' }` is refused, which is precisely the
 *      divergence objectui#3872 reported;
 *   3. "a declared boolean DOES reach the evaluator" — under truthiness it never
 *      does, so the `evaluateCondition` spy is never called with `false`.
 *
 * The two purely tabular tests (the changed-row set, the truthiness-vs-
 * declaredness table) and both tripwires stay GREEN by construction — they
 * assert about `Boolean` / `toPredicateInput` / the engine, not about the gate —
 * and every other execution row stays GREEN too, including `0`, `{}` and all
 * three empty shapes, because the truthy test and the declaredness test agree on
 * every shape except a declared boolean. That is the whole diff, and it is a TIGHTENING:
 * this change can only start refusing execution, never start allowing it (the
 * mirror image of PR #3873, which could only stop blocking).
 */

import { describe, it, expect, vi } from 'vitest';
import { ActionRunner, type ActionContext, type ActionDef } from '../ActionRunner';
import { ActionEngine } from '../ActionEngine';
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
  condition?: unknown;
  /** Does the gate refuse to run the handler? */
  blocked: boolean;
  /** `true` when this row's verdict CHANGED with objectui#3872. */
  changedBy3872?: boolean;
}

const SHAPES: Shape[] = [
  // ── the defect: a declared-and-false gate must block ─────────────────────
  {
    label: 'condition: false (declared "never execute")',
    condition: false,
    blocked: true,
    changedBy3872: true,
  },
  // ── unchanged: a declared-and-true gate runs ────────────────────────────
  { label: 'condition: true', condition: true, blocked: false },
  { label: 'condition absent (undeclared)', absent: true, blocked: false },
  // ── unchanged: real predicates keep their verdicts ──────────────────────
  {
    label: 'condition: bare CEL that is true',
    condition: 'user.role == "admin"',
    blocked: false,
  },
  {
    label: 'condition: bare CEL that is false',
    condition: 'user.role == "guest"',
    blocked: true,
  },
  {
    label: "condition: { dialect: 'cel', source: 'true' }",
    condition: { dialect: 'cel', source: 'true' },
    blocked: false,
  },
  {
    label: "condition: { dialect: 'cel', source: 'false' }",
    condition: { dialect: 'cel', source: 'false' },
    blocked: true,
  },
  {
    label: 'condition: legacy template that is true',
    condition: '${record.status === "active"}',
    blocked: false,
  },
  {
    label: 'condition: legacy template that is false',
    condition: '${record.status === "inactive"}',
    blocked: true,
  },
  // ── unchanged verdict, new reason: nothing was declared ─────────────────
  { label: "condition: '' (empty predicate)", condition: '', blocked: false },
  { label: "condition: '   ' (whitespace-only predicate)", condition: '   ', blocked: false },
  {
    label: "condition: { dialect: 'cel', source: '' } (empty envelope)",
    condition: { dialect: 'cel', source: '' },
    blocked: false,
  },
  // ── unchanged: non-predicate junk fails open ────────────────────────────
  { label: 'condition: 0 (not a predicate)', condition: 0, blocked: false },
  { label: 'condition: {} (not a predicate)', condition: {}, blocked: false },
];

/** Execute one shape and report whether the handler ran. */
async function runShape(shape: Pick<Shape, 'absent' | 'condition'>) {
  const runner = new ActionRunner(CONTEXT);
  const onClick = vi.fn();
  const action: Record<string, unknown> = { onClick };
  if (!shape.absent) action.condition = shape.condition;
  const result = await runner.execute(action as unknown as ActionDef);
  return { result, ran: onClick.mock.calls.length > 0 };
}

describe('ActionRunner.execute — declared `condition` gate (objectui#3872)', () => {
  it.each(SHAPES)('$label', async (shape) => {
    const { result, ran } = await runShape(shape);
    if (shape.blocked) {
      // The handler NOT running is the assertion that matters: objectui#3872 was
      // measured by the handler running despite a declared "never execute".
      expect(ran).toBe(false);
      expect(result).toEqual({ success: false, error: 'Action condition not met' });
    } else {
      expect(ran).toBe(true);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('changes exactly one shape — the declared boolean `false` (tightening only)', () => {
    // Guards the report's per-shape table: if a later edit widens the blast
    // radius, this row-set assertion is what says so.
    expect(SHAPES.filter(s => s.changedBy3872).map(s => s.label)).toEqual([
      'condition: false (declared "never execute")',
    ]);
    // And the direction: the only altered row moved toward REFUSING execution.
    expect(SHAPES.find(s => s.changedBy3872)!.blocked).toBe(true);
  });

  it('a declared boolean and its envelope spelling reach the SAME verdict', async () => {
    // objectui#3872's headline: these two say the identical thing, and before
    // the fix the literal ran while the envelope was refused.
    const literal = await runShape({ condition: false });
    const envelope = await runShape({ condition: { dialect: 'cel', source: 'false' } });
    expect(literal.ran).toBe(false);
    expect(envelope.ran).toBe(false);
    expect(literal.result).toEqual(envelope.result);

    const literalTrue = await runShape({ condition: true });
    const envelopeTrue = await runShape({ condition: { dialect: 'cel', source: 'true' } });
    expect(literalTrue.ran).toBe(true);
    expect(envelopeTrue.ran).toBe(true);
  });

  it('an empty predicate does not even reach the evaluator (the gate decides, not the verdict)', async () => {
    const runner = new ActionRunner(CONTEXT);
    const spy = vi.spyOn(
      runner.getEvaluator() as unknown as { evaluateCondition: (c: unknown) => boolean },
      'evaluateCondition',
    );
    const onClick = vi.fn();
    await runner.execute({ condition: '', onClick } as unknown as ActionDef);
    expect(onClick).toHaveBeenCalledOnce();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a declared boolean DOES reach the evaluator, which short-circuits it', async () => {
    // Why the gate needs no boolean branch of its own: asking the right question
    // at the door is sufficient, because `evaluateCondition` returns a boolean
    // argument verbatim. This is also what makes the fix a two-line change
    // rather than a re-implementation of the verdict.
    const runner = new ActionRunner(CONTEXT);
    const spy = vi.spyOn(
      runner.getEvaluator() as unknown as { evaluateCondition: (c: unknown) => boolean },
      'evaluateCondition',
    );
    await runner.execute({ condition: false, onClick: vi.fn() } as unknown as ActionDef);
    expect(spy).toHaveBeenCalledWith(false);
    spy.mockRestore();

    const ev = new ExpressionEvaluator(CONTEXT);
    expect(ev.evaluateCondition(false)).toBe(false);
    expect(ev.evaluateCondition(true)).toBe(true);
  });
});

describe('why the `condition` gate cannot ask truthiness (objectui#3872)', () => {
  it('truthiness and declaredness disagree on exactly the declared booleans', () => {
    // The mechanism in one table. `hasDeclaredPredicate` is module-private, so
    // its two ingredients are exercised through their public spellings.
    const declared = (v: unknown) =>
      typeof v === 'string' && v.trim() === '' ? false : toPredicateInput(v) !== undefined;

    // `false` is the divergence: not truthy, yet plainly declared.
    expect(Boolean(false)).toBe(false);
    expect(declared(false)).toBe(true);

    // Everywhere else the two questions agree, which is why one row changed.
    for (const v of ['', '   ', 0, {}, { dialect: 'cel', source: '' }]) {
      expect(declared(v), `${JSON.stringify(v)} declares no gate`).toBe(false);
    }
    for (const v of [true, 'user.role == "admin"', { dialect: 'cel', source: 'false' }]) {
      expect(declared(v), `${JSON.stringify(v)} declares a gate`).toBe(true);
      expect(Boolean(v)).toBe(true);
    }
  });

  it('TRIPWIRE (objectui#3871): normalizing the VERDICT would make every template-spelled condition always execute', () => {
    const ev = new ExpressionEvaluator(CONTEXT);
    const falsePredicate = '${record.status === "inactive"}';
    // Raw — the correct verdict, and what this gate evaluates.
    expect(ev.evaluateCondition(falsePredicate)).toBe(false);
    // Normalized — wrapped a second time, unparseable, returned verbatim, truthy.
    // On `disabled` this constant `true` blocks everything (PR #3873's tripwire);
    // on `condition` it does the opposite and RUNS everything, so this key must
    // keep reading the raw value for the same reason.
    expect(toPredicateInput(falsePredicate)).toBe('${${record.status === "inactive"}}');
    expect(ev.evaluateCondition(toPredicateInput(falsePredicate) as never)).toBe(true);
    // When objectui#3871 is fixed this goes RED on the last two expectations —
    // the signal to delete this tripwire and (only then) let the gate evaluate
    // the normalized value.
  });

  it('DOCUMENTED DIVERGENCE: the engine `visible` filter coerces junk, this gate does not', () => {
    // `ActionEngine.getActionsForLocation` is the in-repo template this fix took
    // its shape from, but its non-predicate branch keeps a historical
    // `Boolean(raw)` coercion, so `visible: 0` HIDES. This gate deliberately
    // does not copy that: `catch { isDisabled = false }` already committed this
    // module to fail-OPEN on junk, and a value that is not a predicate must not
    // decide an action's fate. Pinned so the next reader sees the difference is
    // chosen, not overlooked — objectui#3850's follow-up owns unifying it.
    const engine = new ActionEngine(CONTEXT);
    engine.registerAction(
      { name: 'junk_visible', type: 'script', target: '"ran"', visible: 0 } as unknown as ActionDef,
      { locations: ['record_section'] },
    );
    expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
  });
});
