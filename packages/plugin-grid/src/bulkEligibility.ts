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

import { evalRowPredicate, type FieldContainerLike } from '@object-ui/core';
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
 * ones it may not. A def without `visible` is a no-op: `rows` is returned by
 * REFERENCE so the common case allocates nothing and downstream memos hold.
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
  const visible = def?.visible;
  if (visible == null || visible === '') {
    return { eligible: rows as TRow[], skipped: 0 };
  }
  // A BOOLEAN `visible` is a verdict, not an expression — short-circuit it
  // exactly as `useCondition` / `useRowPredicate` do (objectui#3492). Handing
  // it to the engine instead produced `{ dialect: 'cel', source: undefined }`,
  // which faults ("AST-only evaluation not yet supported") and fails CLOSED —
  // so `visible: true`, the most explicit way to say "always offer this",
  // silently disqualified every selected record and hid the button from
  // everyone. `BulkActionDefSchema.visible` is `ExpressionInputSchema` (no
  // boolean), so `objectstack build` cannot emit this shape — hand-written view
  // JSON and in-process callers constructing defs can, and did.
  if (typeof visible === 'boolean') {
    return visible
      ? { eligible: rows as TRow[], skipped: 0 }
      : { eligible: [], skipped: rows.length };
  }

  const eligible = (rows as TRow[]).filter(row =>
    evalRowPredicate(visible as never, row, {
      // Fail CLOSED, exactly as the row kebab does: a predicate that faults
      // must not hand the user a button that acts on records it was written to
      // exclude. `warnOnError` makes the resulting hide diagnosable (once per
      // predicate) instead of silent.
      fallback: false,
      scope: opts.scope,
      fields: opts.fields,
      warnOnError: true,
      label: def?.name,
    }),
  );

  return { eligible, skipped: rows.length - eligible.length };
}
