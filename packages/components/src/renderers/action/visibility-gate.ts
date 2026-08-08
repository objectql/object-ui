/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Did this action DECLARE a visibility gate at all? The one definition read by
 * every member-action leaf on the action face — `action:group`'s inline button
 * and dropdown item, and `action:menu`'s item — so the three cannot drift into
 * three answers for one key (the shape objectui#3142 already had to unpick for
 * `locations` in these same files).
 *
 * Truthiness cannot answer this question, and asking it is the objectui#3812
 * defect: `if (action.visible && !isVisible)` classified `visible: false` — the
 * most explicit way an author can say "never show this" — as *ungated*, so the
 * gate never consulted the verdict and the action rendered for everyone.
 *
 * `!= null && !== ''` is not a new decision. objectui#3492 established it for
 * the selection bar, where `plugin-grid`'s `hasVisibilityGate` spells out the
 * same reasoning verbatim ("Truthiness cannot answer this: `visible: false` is
 * a declared gate that excludes everything"); objectui#3758 / PR #3816 applied
 * it to both row-action surfaces (`isCustomRowActionVisible` in
 * `plugin-grid/src/components/RowActionMenu.tsx` and
 * `renderers/complex/data-table.tsx`).
 *
 * This function decides only whether a gate EXISTS. The verdict is the
 * declaration's own business and is left to the evaluation entry, which already
 * short-circuits a boolean instead of handing it to the CEL engine:
 * `useCondition(toPredicateInput(false))` is `false` and
 * `useCondition(toPredicateInput(true))` is `true`, pinned for both the engine
 * and the renderer path in
 * `packages/react/src/hooks/__tests__/actionPredicate.parity.test.tsx`. Nothing
 * about that entry changes here — only the gate in front of it, which refused
 * to ask.
 *
 * `''` is grouped with `null`/`undefined` deliberately: an empty predicate is
 * nothing to evaluate, so it must not hide the action from everyone either.
 * `toPredicateInput` maps it to `undefined` (visible) for the same reason.
 */
export function hasDeclaredVisibilityGate(visible: unknown): boolean {
  return visible != null && visible !== '';
}
