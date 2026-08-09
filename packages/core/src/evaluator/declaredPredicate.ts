/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { toPredicateInput } from './predicateInput';

/**
 * Is a predicate gate DECLARED on this value — i.e. after normalization, is
 * there still a CONDITION for {@link ExpressionEvaluator.evaluateCondition} to
 * reach a verdict on? (objectui#3850's ruling, key-neutral: `visible` /
 * `hidden` / `enabled` / `disabled` / `condition` all ask it.)
 *
 * This is the ONE definition of that question in the repo, and it lives here —
 * one layer under every consumer, beside {@link toPredicateInput}, whose answer
 * it is derived from. It has to be asked separately from the verdict because
 * `evaluateCondition` documents and implements exactly one default for "there
 * is nothing here to evaluate": it returns `true`, meaning *visible/enabled*.
 * That default is right on `visible` / `enabled` and INVERTED on `disabled`,
 * where `true` means "greyed out" — so a gate that hands an empty predicate to
 * the evaluator gets the strongest possible "yes, disable it" for a value the
 * metadata never used to say anything. Truthiness cannot answer it either, and
 * asking it that way was objectui#3812: `if (action.visible && !isVisible)`
 * read `visible: false` — the most explicit "never show this" an author can
 * write — as *ungated*, and rendered the action for everyone.
 *
 * ## What counts as "nothing to evaluate"
 *
 * Exactly the shapes {@link toPredicateInput} folds to `undefined`, plus the one
 * it wraps instead of folding:
 *
 *   - `null` / `undefined` — no key at all.
 *   - `''` — an empty predicate (objectui#3492 / objectui#3842).
 *   - a whitespace-only string — the shape the normalizer does NOT collapse
 *     (`'   '` becomes `'${   }'`), named here so it cannot slip through. Core's
 *     other predicate entries already treat it as blank: `evaluateCondition`
 *     (`if (!trimmed) return true`) and `evalRowPredicate`
 *     (`evaluator/listConditional.ts`, `if (!source.trim())`).
 *   - `{ dialect, source: '' }` — the empty ENVELOPE. This is not an exotic
 *     spelling: `@objectstack/spec`'s `ExpressionInputSchema` normalizes every
 *     authored predicate into an envelope, so "author left the predicate empty"
 *     compiles to exactly this, which makes it the likeliest empty shape in real
 *     metadata (objectui#3850).
 *   - anything that is not a predicate at all (`0`, `{}`, an array): a value the
 *     evaluator cannot read must not be the reason a control is disabled or an
 *     action refuses to run. Fail-open on junk, which is the posture
 *     `ActionRunner` already committed to (`catch { isDisabled = false }`).
 *
 * A declared-and-`false` gate is DECLARED (`toPredicateInput` returns the
 * boolean unchanged): `disabled: false` / `visible: false` are verdicts, and
 * routing them to the evaluator — which short-circuits booleans — is the point
 * of asking "declared?" rather than "truthy?".
 *
 * ## The one blank shape this scope does NOT cover (objectui#3960)
 *
 * An envelope whose `source` is blank but not EMPTY —
 * `{ dialect: 'cel', source: '   ' }` — is still "declared" here, because
 * `toPredicateInput` folds a `source` of `''` and does not trim. So the string
 * spelling of a blank predicate is trimmed and the envelope spelling is not,
 * which means `disabled` still greys out for that one value while core's own CEL
 * entry calls it "no predicate" (`evaluateCelCondition`: `if (!source.trim())
 * return true`). objectui#3850's ruling enumerated three empty spellings and this
 * is a fourth, so it is filed rather than widened in here — the asymmetry is
 * pinned in `__tests__/declaredPredicate.test.ts` so it cannot be mistaken for
 * a covered case.
 *
 * ## Why the callers still evaluate the RAW value
 *
 * Every consumer normalizes to decide DECLAREDNESS and then evaluates whatever
 * it was given, `evaluateCondition(raw)` or `evaluateCondition(toPredicateInput(
 * raw))` as it did before. Both agree since objectui#3871 made the normalizer
 * idempotent for an already-`${…}` string; before that they did not, and a
 * template-spelled predicate normalized twice came back as a constant. Nothing
 * here changes a verdict for a value that HAS one — this gate only decides
 * whether there is one to reach.
 *
 * ## Scope history (objectui#3850)
 *
 * The question used to be answered three times with three different scopes: the
 * renderer-side `hasDeclaredVisibilityGate` (`!= null && !== ''`, so every
 * object counted — including the empty envelope), `SchemaRenderer`'s inline
 * `!== undefined` (wider still: `disabled: null` greyed the control out,
 * objectui#3862), and `ActionRunner`'s module-private helper (this scope, which
 * arrived first with objectui#3848 and is what the ruling adopted). One
 * definition with one scope replaces all three:
 * `components/renderers/action/visibility-gate.ts` re-exports this function
 * under its historic name `hasDeclaredVisibilityGate` (the five member-action
 * renderer call sites are unchanged), `SchemaRenderer`'s `disabled` /
 * `disabledOn` chain reads it, and `ActionRunner`'s two gates read it instead of
 * a private twin.
 */
export function hasDeclaredPredicate(value: unknown): boolean {
  if (typeof value === 'string' && value.trim() === '') return false;
  return toPredicateInput(value) !== undefined;
}
