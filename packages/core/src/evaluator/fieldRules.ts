/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Client-side evaluation of field-level conditional rules
 * (`visibleWhen` / `readonlyWhen` / `requiredWhen`).
 *
 * These predicates are authored as CEL — the *same* dialect the server
 * enforces in `@objectstack/objectql`'s rule-validator (`requiredWhen`) and
 * `stripReadonlyWhenFields` (`readonlyWhen`). To guarantee the client UX and
 * the server enforcement reach the *identical* verdict for a given record we
 * delegate to the canonical engine, `@objectstack/formula`'s
 * `ExpressionEngine`, rather than re-implementing a parallel evaluator. See
 * ADR-0036 (field-level conditional rules) and the framework's
 * `packages/formula` "No private expression DSL" note.
 *
 * A predicate is `string | { dialect, source }`. A bare string is treated as
 * CEL (mirrors the server's `toExpression`). Evaluation is *fail-open* for
 * visibility/required (a broken predicate must not hide a field or wrongly
 * block submit) and *fail-open* for readonly (a broken predicate leaves the
 * field editable).
 *
 * Fail-open agrees with the server for MOST faults — but not for all, and the
 * exception is the half worth knowing. Since objectstack#4889 a `readonlyWhen`
 * predicate that faults because it names a scope ROOT the write never bound —
 * `parent.status == 'paid'` with no master-detail header in hand — is
 * fail-CLOSED on the server: `isReadonlyWhenLocked` warns and then returns
 * TRUE, i.e. LOCKED (a declared lock is not waived merely because it could not
 * be evaluated), and `stripReadonlyWhenFields` — plus
 * `stripReadonlyWhenFieldsMulti` on the bulk path — DELETES that key from the
 * UPDATE payload. This file keeps the same fault fail-OPEN. For that one class
 * the two ends therefore point in OPPOSITE directions, deliberately: the
 * framework's ADR-0057 D10 — server enforces, client is courtesy (framework
 * numbering; this repo's own ADR-0057 is an unrelated document) — makes the
 * server the authority, so the courtesy layer does not get to guess "locked"
 * and grey out a field the server might have accepted.
 *
 * The caller-visible consequence, spelled out because the symptom is silent:
 * the form renders the field EDITABLE, the user edits it, the save reports
 * SUCCESS, and the new value never lands — the server dropped the key and kept
 * the persisted one. Debug that toward the SERVER-side lock (its `… treating
 * the field as LOCKED` warning, and the write response's `droppedFields`), not
 * toward the client predicate, which did exactly what it was asked to. The
 * other two halves carry no such carve-out: `requiredWhen` binds the same
 * `parent` scope but deliberately kept fail-open semantics (objectstack#4977),
 * so an unevaluable requirement is skipped on BOTH ends, and field-level
 * `visibleWhen` is not a server concept at all.
 *
 * Fail-open is **loud**, not silent (objectstack#5149): a predicate that
 * cannot be evaluated — parse error, unbound identifier, engine fault — logs
 * one `console.warn` per predicate text with the source and the failure
 * reason, then still returns the caller's fallback. Without the warning a
 * broken predicate is indistinguishable from an absent one, so
 * conditional-visibility bugs survive inspection indefinitely. This is the
 * client half of the server's "log and allow" convention for the faults where
 * the two ends DO agree (`readonlyWhen for 'x' failed to evaluate — change
 * allowed through` — the GENERIC-fault message; the unbound-root fault above
 * logs `treating the field as LOCKED` instead). The *default* stays
 * fail-open on purpose — flipping it is a shipped-behavior change tracked
 * separately in objectstack#5149 (appeal 1, undecided).
 */
import { ExpressionEngine } from '@objectstack/formula';
import type { Expression } from '@objectstack/spec';

/** A field-rule predicate as authored in metadata. */
export type FieldRulePredicate = string | { dialect?: string; source: string };

/** Normalize a predicate into the `Expression` shape the engine expects. */
function toExpression(pred: FieldRulePredicate): Expression {
  if (typeof pred === 'string') return { dialect: 'cel', source: pred };
  return { dialect: (pred.dialect ?? 'cel') as Expression['dialect'], source: pred.source };
}

/** Diagnostic options for {@link evalFieldPredicate} evaluation failures. */
export interface FieldPredicateDiagnostic {
  /**
   * Human-readable locator included in the one-time failure warning — e.g.
   * `"visibleWhen of field 'amount'"`. Pass whatever the call site knows; the
   * predicate source text and failure reason are always included.
   */
  context?: string;
  /**
   * Set `false` when the caller deliberately probes for faults (evaluating
   * twice with both fallbacks) and surfaces its own diagnostic — prevents two
   * warnings for one broken predicate. Defaults to `true`.
   */
  warn?: boolean;
  /**
   * Called with the engine's failure reason (`"[kind] message"`, the exact text
   * the built-in warning prints after `Reason:`) when the predicate cannot be
   * evaluated. This is the passback for callers that set `warn: false` and
   * report the fault themselves — without it, silencing the built-in warning
   * also discards the only description of *why* the predicate failed, which is
   * how the fail-closed row-predicate path ended up the least debuggable one
   * (objectui#3792).
   *
   * Independent of `warn` and of the one-time-warning dedupe: it fires on every
   * fault, so a caller doing its own warn-once bookkeeping keeps control of it.
   * The returned verdict is unaffected. Must not throw — it is invoked outside
   * the engine guard, so an exception here propagates to the caller rather than
   * being reported as an engine fault.
   */
  onFault?: (reason: string) => void;
}

const warnedPredicates = new Set<string>();

/**
 * One-time warning for a predicate that could not be evaluated. Deduped per
 * predicate TEXT (dialect + source): a broken predicate is re-evaluated on
 * every render/keystroke, and the point is one loud line, not a scrolling
 * wall. The dedupe key is JSON-encoded — never a control-character separator
 * (objectstack#5450 made a sibling of this file binary to grep that way).
 */
function warnPredicateFailure(
  expr: Expression,
  fallback: boolean,
  reason: string,
  context?: string,
): void {
  const key = JSON.stringify([expr.dialect, expr.source]);
  if (warnedPredicates.has(key)) return;
  warnedPredicates.add(key);
  console.warn(
    '[object-ui] A conditional predicate failed to evaluate' +
      (context ? ` (${context})` : '') +
      ` and was treated as its safe default (${String(fallback)}): ` +
      JSON.stringify(expr.source) +
      `. Reason: ${reason}. ` +
      "Values are bound under 'record.' (e.g. record.status) — check the field names and CEL syntax.",
  );
}

/**
 * Evaluate a field-rule CEL predicate against a record.
 *
 * @param pred      The `visibleWhen` / `readonlyWhen` / `requiredWhen` predicate.
 * @param record    The live form values (overlays prior persisted record).
 * @param fallback  Value to return when the predicate is absent or fails to
 *                  evaluate. Pick the *safe* default for the caller:
 *                  `false` for readonly/required (don't lock/block on error),
 *                  `true` for visibility (don't hide on error).
 * @param previous  The prior persisted record, if any (for `previous.*` refs).
 * @param scope     Extra top-level scope variables bound alongside `record` —
 *                  e.g. `{ parent }` so an inline line-item cell can reference
 *                  its header (`parent.status == 'paid'`) as well as its own
 *                  row (`record.quantity`). Bound via the engine's `extra`.
 * @param diagnostic  Failure-warning options: a `context` locator for the
 *                  one-time warning, and `warn: false` for callers that probe
 *                  for faults and report them themselves. The returned value
 *                  is unaffected either way.
 */
export function evalFieldPredicate(
  pred: FieldRulePredicate | undefined | null,
  record: Record<string, unknown>,
  fallback: boolean,
  previous?: Record<string, unknown>,
  scope?: Record<string, unknown>,
  diagnostic?: FieldPredicateDiagnostic,
): boolean {
  if (pred == null || (typeof pred === 'string' && !pred.trim())) return fallback;
  const expr = toExpression(pred);
  // The two fault sources — a not-ok verdict and a throw that slipped past the
  // engine's "never throws" contract — converge on one reason string and one
  // reporting site below, so the built-in warning and the `onFault` passback
  // can never describe the failure differently.
  let reason: string | undefined;
  let value = fallback;
  try {
    const res = ExpressionEngine.evaluate<boolean>(expr, {
      record,
      previous,
      ...(scope ? { extra: scope } : {}),
    });
    // Parse error, type error, unbound identifier, engine fault … — every
    // not-ok verdict resolves to the fallback, but never silently (#5149).
    if (!res.ok) reason = `[${res.error.kind}] ${res.error.message}`;
    else value = res.value === true;
  } catch (err) {
    reason = `[throw] ${err instanceof Error ? err.message : String(err)}`;
  }
  if (reason !== undefined) {
    if (diagnostic?.warn !== false) {
      warnPredicateFailure(expr, fallback, reason, diagnostic?.context);
    }
    // Outside the try on purpose: a throwing callback is a caller bug and must
    // surface as one, not be swallowed and re-reported as an engine fault.
    diagnostic?.onFault?.(reason);
    return fallback;
  }
  return value;
}

/**
 * Resolve the effective `{ visible, readonly, required }` state for a field
 * given its conditional rules and the live record. Each `*When` rule, when
 * present, *overrides* the static flag. A static `true` is never weakened by a
 * `false` predicate result for required/readonly — but `visibleWhen` is
 * authoritative when present (so a field can be conditionally shown/hidden).
 *
 * @param fieldContext  Optional locator for failure warnings — e.g.
 *                      `"field 'amount'"`. The warning then reads
 *                      `visibleWhen of field 'amount' …`; without it, the rule
 *                      kind alone is reported.
 */
export function resolveFieldRuleState(
  rules: {
    visibleWhen?: FieldRulePredicate;
    readonlyWhen?: FieldRulePredicate;
    requiredWhen?: FieldRulePredicate;
  },
  record: Record<string, unknown>,
  statics: { required?: boolean; readonly?: boolean },
  previous?: Record<string, unknown>,
  scope?: Record<string, unknown>,
  fieldContext?: string,
): { visible: boolean; readonly: boolean; required: boolean } {
  const diag = (rule: string): FieldPredicateDiagnostic => ({
    context: fieldContext ? `${rule} of ${fieldContext}` : rule,
  });

  const visible =
    rules.visibleWhen != null
      ? evalFieldPredicate(rules.visibleWhen, record, true, previous, scope, diag('visibleWhen'))
      : true;

  const readonly =
    statics.readonly === true ||
    (rules.readonlyWhen != null
      ? evalFieldPredicate(rules.readonlyWhen, record, false, previous, scope, diag('readonlyWhen'))
      : false);

  const required =
    statics.required === true ||
    (rules.requiredWhen != null
      ? evalFieldPredicate(rules.requiredWhen, record, false, previous, scope, diag('requiredWhen'))
      : false);

  return { visible, readonly, required };
}
