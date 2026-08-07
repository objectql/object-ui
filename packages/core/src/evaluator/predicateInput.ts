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
 * Normalize a schema-supplied predicate (`visible` / `enabled` / `disabled` /
 * `hidden`) into the form {@link ExpressionEvaluator.evaluateCondition}
 * expects.
 *
 * Accepts:
 *   - `boolean` → returned as-is (predicate evaluation short-circuits).
 *   - `string`  → wrapped as `${string}` (legacy DX shorthand).
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
 * above describes the failure mode of). What pins that now is the identity
 * assertion in
 * `packages/react/src/hooks/__tests__/actionPredicate.parity.test.tsx` — the
 * react export must BE this function object — alongside the engine-path vs
 * renderer-path verdict parity suite in the same file, which is a separate
 * claim and still earns its keep: sharing a normalizer does not by itself
 * prove the two call paths reach the same verdict.
 */
export function toPredicateInput(value: unknown): EvaluatorPredicateInput {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return `\${${value}}`;
  if (typeof value === 'object' && typeof (value as { source?: unknown }).source === 'string') {
    const src = (value as { source: string }).source;
    if (!src) return undefined;
    // Preserve a CEL-dialect envelope so `evaluateCondition` routes it to the
    // canonical `@objectstack/formula` engine (identical verdict to the
    // server) instead of collapsing it onto the legacy JS path.
    if ((value as { dialect?: unknown }).dialect === 'cel') return { dialect: 'cel', source: src };
    // Every other dialect (template / unset) keeps the legacy `${…}` behavior.
    return `\${${src}}`;
  }
  return undefined;
}
