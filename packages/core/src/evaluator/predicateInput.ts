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
 */
export type PredicateInput =
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
 * This is the canonical, engine-side helper — `@object-ui/core` is the common
 * dependency of every consumer, so renderer-side code (`@object-ui/react`'s
 * `toPredicateInput`, which has identical semantics and is pinned to this one
 * by a parity test) and engine-side code can share one normalization instead
 * of hand-rolling envelope unwrapping per call site.
 */
export function toPredicateInput(value: unknown): PredicateInput {
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
