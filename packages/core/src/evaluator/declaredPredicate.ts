/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { toPredicateInput } from './predicateInput.js';

/**
 * Is the predicate TEXT blank — in EITHER spelling? (objectui#3960)
 *
 * `'   '` and `{ dialect: 'cel', source: '   ' }` are the same author mistake
 * written two ways, and {@link toPredicateInput} folds neither: it wraps a
 * whitespace-only string into `'${   }'`, and it only folds an envelope whose
 * `source` is exactly `''`. So blankness cannot be derived from the normalizer's
 * answer and has to be stated once, here, for both spellings — trimming one and
 * not the other is the asymmetry objectui#3960 measured (`disabled` greyed out,
 * `ActionRunner` refused to execute, for a predicate that says nothing).
 *
 * This is not a fourth dialect of "empty": it is the SAME rule core's evaluation
 * entries already apply on the value side — `evaluateCondition`
 * (`if (!trimmed) return true`), `evaluateCelCondition` (`if (!source.trim())
 * return true`), `evalRowPredicate` (`listConditional.ts`) — brought to the one
 * place that answers "is there a condition at all?", so the two halves cannot
 * disagree about the same blank.
 */
function isBlankPredicateText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() === '';
  if (value !== null && typeof value === 'object') {
    const source = (value as { source?: unknown }).source;
    if (typeof source === 'string') return source.trim() === '';
  }
  return false;
}

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
 * Exactly the shapes {@link toPredicateInput} folds to `undefined`, plus the two
 * BLANK spellings it wraps or passes through instead of folding:
 *
 *   - `null` / `undefined` — no key at all.
 *   - `''` — an empty predicate (objectui#3492 / objectui#3842).
 *   - blank predicate TEXT, in either spelling — a whitespace-only string
 *     (`'   '`, which the normalizer wraps into `'${   }'`) and an envelope whose
 *     `source` is whitespace-only (`{ dialect: 'cel', source: '   ' }`, which the
 *     normalizer passes through because it only folds a `source` of `''`).
 *     Neither can be read off the normalizer's answer, so both are named here —
 *     see {@link isBlankPredicateText} for why this is the layer that says it.
 *     Core's other predicate entries already treat both as blank:
 *     `evaluateCondition` (`if (!trimmed) return true`), `evaluateCelCondition`
 *     (`if (!source.trim()) return true`) and `evalRowPredicate`
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
 * ## Why blankness is decided HERE and not in the normalizer (objectui#3960)
 *
 * The blank-`source` envelope arrived one release late: objectui#3850's ruling
 * enumerated three empty spellings, `toPredicateInput` folds a `source` of `''`
 * and does not trim, so `{ dialect: 'cel', source: '   ' }` stayed "declared"
 * while core's own CEL entry called that exact value "no predicate" — `disabled`
 * greyed out and `ActionRunner` refused to execute for a predicate that says
 * nothing (objectui#3960). The asymmetry was that this definition trimmed the
 * STRING spelling of a blank predicate and not the ENVELOPE spelling of the same
 * blank.
 *
 * Fixing it at the normalizer instead (`if (!src.trim()) return undefined`) would
 * have aligned every `evaluateCondition(toPredicateInput(x))` consumer at once,
 * and that is precisely why it is the wider, wrong lever: it changes what
 * normalization MEANS, which is a shape question ("what does the evaluator
 * accept"), to answer a declaredness question ("is there a condition"). Those are
 * different concepts on purpose — a blank `source` is a shape the evaluator
 * accepts and answers `true` for, by its own documented rule. The blast radius is
 * the concrete difference: at the normalizer, a NON-cel blank envelope
 * (`{ source: '   ' }` → `'${   }'` → falsy) flips verdict for every
 * `useCondition(toPredicateInput(…))` call site including the container-level
 * `visible` reads in `action-bar` / `action-group` / `action-menu` /
 * `RelatedList` / `record-alert`, none of which ask this question at all; here it
 * flips only for the consumers that DO ask it, and only on the inverted-polarity
 * keys where "declared" is what turns a control off.
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
 *
 * Two more consumers joined afterwards, and with them the last two places that
 * answered this question with a range of their own:
 * `SchemaRenderer`'s `hidden` / `hiddenOn` legs, whose verdict is NOT negated so
 * an empty predicate made the node VANISH (objectui#3955), and
 * `ActionEngine.getActionsForLocation`'s `visible` filter, which folded some
 * empty spellings by hand and coerced the rest with `Boolean(raw)`, so
 * `visible: 0` hid an action the renderers showed (objectui#3957). Nothing in the
 * repo now asks "is a gate declared?" anywhere but here.
 */
export function hasDeclaredPredicate(value: unknown): boolean {
  if (isBlankPredicateText(value)) return false;
  return toPredicateInput(value) !== undefined;
}
