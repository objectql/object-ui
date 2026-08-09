/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The normalized shape {@link ExpressionEvaluator.evaluateCondition} consumes:
 * a boolean (short-circuits), a `${…}` template string (legacy JS path), a
 * `{ dialect: 'cel', source }` envelope (canonical `@objectstack/formula`
 * path), or `undefined` for "no predicate declared".
 *
 * ## Why not `PredicateInput` (objectstack#4115 / objectui#3074)
 *
 * `@objectstack/spec` owns `PredicateInput` — and it is a genuinely DIFFERENT
 * concept, so wearing that name would be the exact drift this repo's
 * `check:spec-symbols` gate exists to stop. The spec's is
 * `z.input<typeof PredicateInputSchema>`: what an author WRITES, before
 * normalization — a bare string, or an envelope over the full dialect set
 * (`cel` | `cron` | `template`) with optional `source` / `ast` / `meta`.
 *
 * This one is the OUTPUT of normalization: what the evaluator ACCEPTS. It
 * admits `boolean` and the `${…}` template spelling (neither of which the spec
 * models as a predicate), narrows `dialect` to `cel` alone (every other dialect
 * has already been flattened onto the legacy path by `toPredicateInput`),
 * requires a non-empty `source`, and carries no `ast` / `meta`. The two unions
 * are not mutually assignable in either direction.
 *
 * The rename is pinned from both sides by the tripwire in
 * `packages/core/src/utils/__tests__/spec-symbol-batch4.test.ts`: the spec must
 * still own `PredicateInput` (else this rename has lost its reason), and must
 * still NOT own `EvaluatorPredicateInput` (the objectui#3074 mistake of
 * renaming onto another name the spec already holds).
 */
export type EvaluatorPredicateInput =
  | string
  | boolean
  | { dialect: 'cel'; source: string }
  | undefined;

/**
 * Wrap a BARE expression as a `${…}` template, and leave a string that already
 * carries template syntax alone (objectui#3871 — rationale in
 * {@link toPredicateInput}'s doc below). One rule, so the two string spellings
 * inside the normalizer cannot drift apart.
 */
function wrapIfBare(expression: string): string {
  return expression.includes('${') ? expression : `\${${expression}}`;
}

/**
 * Normalize a schema-supplied predicate (`visible` / `enabled` / `disabled` /
 * `hidden`) into the form {@link ExpressionEvaluator.evaluateCondition}
 * expects.
 *
 * Accepts:
 *   - `boolean` → returned as-is (predicate evaluation short-circuits).
 *   - `string`  → a BARE expression is wrapped as `${string}` (legacy DX
 *     shorthand); a string that is already a `${…}` template is ALREADY in the
 *     normalized shape and is returned untouched (objectui#3871, below).
 *   - `Expression` envelope `{ dialect, source }` (the normalized form
 *     `@objectstack/spec`'s `ExpressionInputSchema` produces for every
 *     authored predicate, including bare strings) → a `cel` dialect keeps
 *     its envelope; every other dialect is unwrapped and wrapped as
 *     `${source}`.
 *   - `null` / `undefined` / empty / anything else → `undefined`
 *     (default visible/enabled).
 *
 * ## Why the `cel` envelope must survive normalization (#2661 / #3314)
 *
 * `evaluateCondition` routes to the canonical `@objectstack/formula` engine —
 * the one the SERVER enforces with — only while the argument is still a
 * `{ dialect: 'cel' }` object. Collapse it to `${source}` first and the
 * predicate silently falls to the legacy JS evaluator, whose semantics
 * differ: CEL has no `<` overload for `null`, so `null < null` faults and
 * fail-closed hides, while JS quietly yields `false`; CEL-only builtins
 * (`today()`, objectstack#3205) do not exist on the JS path at all. Two
 * normalizers that disagree on this one branch therefore make the SAME
 * `visible:` predicate reach different verdicts depending on whether the
 * action was surfaced by `ActionEngine.getActionsForLocation` or rendered
 * standalone (#3314).
 *
 * This is THE implementation, not one of two — `@object-ui/core` is the common
 * dependency of every consumer, so engine-side code and renderer-side code
 * share one normalization instead of hand-rolling envelope unwrapping per call
 * site. `@object-ui/react`'s `toPredicateInput` is a re-export of this function
 * (since #3367; it used to be an independent twin held in step by a 14-shape
 * normalization parity table, which is exactly the arrangement the paragraph
 * above describes the failure mode of).
 *
 * ## Why an already-`${…}` string is NOT wrapped again (objectui#3871)
 *
 * `${…}` is one of the spellings this repo documents for a predicate
 * (AGENTS.md §4: `hidden?: string; // expression: "${data.role != 'admin'}"`)
 * AND one of the shapes {@link EvaluatorPredicateInput} lists as a normalized
 * OUTPUT. Wrapping unconditionally therefore corrupted every value that was
 * already normalized: `'${x}'` became `'${${x}}'`, which no longer matches
 * `ExpressionEvaluator`'s single-template fast path (`/^\$\{([^}]+)\}$/` —
 * `[^}]+` cannot cross the inner `}`), so it fell to the global replace, whose
 * inner expression `'${x'` does not parse. The verdict then stopped depending
 * on the predicate at all, in a direction set by the CALLER's error policy:
 *
 *   - fail-soft callers (every `disabled` / `enabled` leg, and the `visible`
 *     legs of `action:group` / `action:icon` / `RelatedList`) got the original
 *     non-empty string back from the evaluator's `catch { return match }`, so
 *     `Boolean(…)` was a constant `true` — `disabled` greyed out forever,
 *     `visible` shown forever, `enabled` never disabling.
 *   - fail-closed callers (`throwOnError: true` — `action:button` / `action:bar`
 *     / `action:menu` / `DeclaredActionsBar` `visible`, and
 *     `ActionEngine.getActionsForLocation`) got a THROW, so the constant was
 *     the other one: the action was hidden forever, including when its
 *     predicate held.
 *
 * Either way the author's expression was never consulted. The guard is
 * `includes('${')` — "does this string already carry template syntax", the
 * same question `evaluateCondition` itself asks before choosing the template
 * path — not an anchored full match: a multi-part string like `'a ${x} b'` is
 * not a predicate in any spelling, and wrapping it produced the same constant
 * verdict, so the narrower guard would buy nothing and would still corrupt a
 * value the evaluator can read.
 *
 * The same guard covers the envelope branch below, where the unwrapped
 * `source` reaches the identical wrap one line later. It is one defect with two
 * spellings, and `{ dialect: 'template', source: '${x}' }` is the shape a
 * producer that compiles an authored template emits. A bare `source` (what
 * `@objectstack/spec`'s `ExpressionInputSchema` produces today, pinned in
 * `packages/react/src/hooks/__tests__/useExpression.test.ts`) is unaffected.
 *
 * What this does NOT do is decide whether `${…}` SHOULD be authorable on an
 * action predicate: `@objectstack/spec`'s `PredicateInput` models a bare string
 * and a dialect envelope, not the template spelling. Rejecting it loudly at
 * publish time is a spec-side ruling (deferred to the objectstack seat by the
 * objectui#3871 dispatch); until then this normalizer must not silently invent
 * a verdict for a spelling both the docs and this file's own output type bless.
 *
 * What pins the single implementation is the identity assertion in
 * `packages/react/src/hooks/__tests__/actionPredicate.parity.test.tsx` — the
 * react export must BE this function object — alongside the engine-path vs
 * renderer-path verdict parity suite in the same file, which is a separate
 * claim and still earns its keep: sharing a normalizer does not by itself
 * prove the two call paths reach the same verdict.
 */
export function toPredicateInput(value: unknown): EvaluatorPredicateInput {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return wrapIfBare(value);
  if (typeof value === 'object' && typeof (value as { source?: unknown }).source === 'string') {
    const src = (value as { source: string }).source;
    if (!src) return undefined;
    // Preserve a CEL-dialect envelope so `evaluateCondition` routes it to the
    // canonical `@objectstack/formula` engine (identical verdict to the
    // server) instead of collapsing it onto the legacy JS path.
    if ((value as { dialect?: unknown }).dialect === 'cel') return { dialect: 'cel', source: src };
    // Every other dialect (template / unset) keeps the legacy `${…}` behavior.
    return wrapIfBare(src);
  }
  return undefined;
}
