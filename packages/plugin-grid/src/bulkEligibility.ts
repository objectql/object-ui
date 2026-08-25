/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Per-record `visible` eligibility for a bulk action (objectui#3067).
 *
 * ## The rule
 *
 * A bulk def's `visible` is evaluated **once per selected record, with that
 * record in scope** — the same binding and the same fail-closed contract the
 * row kebab uses (`useRowPredicate(..., { fallback: false })`). From that one
 * evaluation both questions are answered:
 *
 *   - **Is the button offered?** Yes when at least one selected record passes.
 *     A record-free predicate (`features.x`, `current_user.y`) returns the same
 *     verdict for every row, so it behaves exactly like a button-level gate —
 *     no need to detect whether the author referenced `record`.
 *   - **Which records does it run on?** The ones that passed. The rest are
 *     reported as skipped rather than silently included.
 *
 * ## What this replaces
 *
 * The bar used to evaluate `visible` against the ambient scope with no record
 * bound, on the lenient path. That does not fail open — it returns `true` for
 * *every* row-scoped predicate, including the ones that should be false:
 * `${record.done}` and `${record.owner == user.id}` both evaluated `true` with
 * no record in scope. So an authored gate was not weakened, it was inverted for
 * half its inputs, and nothing distinguished that from a real verdict.
 *
 * The mechanism predates objectui#3002, but only inline-authored
 * `bulkActionDefs[].visible` used to reach it — written by authors who knew
 * there was no record. #3031 began promoting object actions into the bar, and
 * their `visible` is typically written for a row/record surface, which is what
 * made row-scoped predicates land in a record-free evaluation.
 */

import { partitionRowsByPredicate, type FieldContainerLike } from '@object-ui/core';
import type { BulkActionDef } from '@object-ui/types';

export interface BulkEligibility<TRow> {
  /** Records whose `visible` passed — the ones the action actually runs on. */
  eligible: TRow[];
  /**
   * How many selected records were filtered out. Surfaced to the user in the
   * dialog: a run over fewer records than they selected must say so.
   */
  skipped: number;
}

/**
 * A def as far as this fold is concerned. `visible` is widened with `boolean`
 * beyond `BulkActionDef`'s `ExpressionInput`: the schema cannot emit one, but
 * hand-written view JSON and in-process callers do, and the fold owes them the
 * same short-circuit every other predicate surface gives (see below).
 */
export type BulkEligibilityDef = Pick<BulkActionDef, 'name'> & {
  visible?: BulkActionDef['visible'] | boolean;
};

/**
 * Whether the def declares a visibility gate at all — the ONE definition of
 * "gated", shared by the fold and by the button that renders its verdict.
 *
 * The bar reads it because "no record qualified" only means "hide me" for a def
 * that gated itself; an ungated def renders regardless. Truthiness cannot
 * answer this: `visible: false` is a declared gate that excludes everything,
 * and testing `def.visible &&` classified it as *ungated* — which rendered the
 * button `false` was written to remove (objectui#3492).
 */
export function hasVisibilityGate(def: BulkEligibilityDef | null | undefined): boolean {
  const visible = def?.visible;
  return visible != null && visible !== '';
}

/**
 * Split selected records into the ones this def may act on and a count of the
 * ones it may not.
 *
 * The loop, the boolean short-circuit and the fail-closed posture all live in
 * `@object-ui/core`'s {@link partitionRowsByPredicate} — the ONE per-record
 * fold every bulk surface shares (the built-in selection-bar Delete reads it
 * through the same primitive, objectui#4420). This function is the `def`-shaped
 * door onto it: it knows only that a bulk def spells its predicate `visible`
 * and labels warnings with the def's name.
 */
export function partitionBulkRows<TRow extends Record<string, unknown>>(
  def: BulkEligibilityDef | null | undefined,
  rows: readonly TRow[],
  opts: {
    scope?: Record<string, unknown>;
    /**
     * The object's field definitions, so a `visible` comparing a relation field
     * sees the stored foreign key rather than the record `$expand` substituted
     * for it — the selection bar's rows come straight off the grid's expanded
     * fetch. See `toPredicateRecord`.
     */
    fields?: FieldContainerLike;
  } = {},
): BulkEligibility<TRow> {
  return partitionRowsByPredicate(def?.visible as never, rows, {
    scope: opts.scope,
    fields: opts.fields,
    warnOnError: true,
    label: def?.name,
  });
}
