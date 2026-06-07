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
 * field editable) — matching the server, which logs and allows the change
 * through.
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
 */
export function evalFieldPredicate(
  pred: FieldRulePredicate | undefined | null,
  record: Record<string, unknown>,
  fallback: boolean,
  previous?: Record<string, unknown>,
): boolean {
  if (pred == null || (typeof pred === 'string' && !pred.trim())) return fallback;
  try {
    const res = ExpressionEngine.evaluate<boolean>(toExpression(pred), { record, previous });
    if (!res.ok) return fallback;
    return res.value === true;
  } catch {
    return fallback;
  }
}

/**
 * Resolve the effective `{ visible, readonly, required }` state for a field
 * given its conditional rules and the live record. Each `*When` rule, when
 * present, *overrides* the static flag. A static `true` is never weakened by a
 * `false` predicate result for required/readonly — but `visibleWhen` is
 * authoritative when present (so a field can be conditionally shown/hidden).
 */
export function resolveFieldRuleState(
  rules: {
    visibleWhen?: FieldRulePredicate;
    readonlyWhen?: FieldRulePredicate;
    requiredWhen?: FieldRulePredicate;
    /** Back-compat alias of `requiredWhen` (spec @deprecated). */
    conditionalRequired?: FieldRulePredicate;
  },
  record: Record<string, unknown>,
  statics: { required?: boolean; readonly?: boolean },
  previous?: Record<string, unknown>,
): { visible: boolean; readonly: boolean; required: boolean } {
  const visible =
    rules.visibleWhen != null
      ? evalFieldPredicate(rules.visibleWhen, record, true, previous)
      : true;

  const readonly =
    statics.readonly === true ||
    (rules.readonlyWhen != null
      ? evalFieldPredicate(rules.readonlyWhen, record, false, previous)
      : false);

  const requiredPred = rules.requiredWhen ?? rules.conditionalRequired;
  const required =
    statics.required === true ||
    (requiredPred != null ? evalFieldPredicate(requiredPred, record, false, previous) : false);

  return { visible, readonly, required };
}
