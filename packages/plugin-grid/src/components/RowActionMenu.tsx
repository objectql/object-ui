/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@object-ui/components';
import { Edit, Trash2, MoreVertical } from 'lucide-react';
import { evalRowPredicate, type CrudAffordances } from '@object-ui/core';
import { useObjectTranslation, useRowPredicate, useCapabilityGate, usePredicateScope } from '@object-ui/react';

const ROW_ACTION_FALLBACKS: Record<string, string> = {
  'grid.openMenu': 'Open menu',
  'grid.edit': 'Edit',
  'grid.delete': 'Delete',
};

function useRowActionTranslation() {
  // useObjectTranslation is provider-safe (react-i18next falls back to the
  // global instance and never throws), so no try/catch — wrapping the hook call
  // would violate rules-of-hooks. The per-key fallback still applies below.
  const { t } = useObjectTranslation();
  return (key: string) => {
    const v = t(key);
    return v === key ? (ROW_ACTION_FALLBACKS[key] ?? key) : v;
  };
}

/**
 * Format an action identifier string into a human-readable label.
 * e.g., 'send_email' → 'Send Email'
 */
export function formatActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Action definition for row-context menu items. Subset of ActionDef. */
export interface RowActionDef {
  name: string;
  label?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  confirmText?: string;
  /** Original action def — forwarded to the dispatcher untouched. */
  [key: string]: any;
}

/**
 * Per-record CEL predicates gating a built-in Edit/Delete row action
 * (objectui#2614) — DERIVED from the type whose values this file actually
 * receives, never restated by hand (objectui#4429, inheriting PR #4423).
 *
 * The source is NOT the data-table's `DataTableSchema.rowEditPredicates` /
 * `rowDeletePredicates`: this surface is never handed those keys. `ObjectGrid`
 * resolves the OBJECT's `userActions.edit` / `delete` through
 * `resolveRowCrudAffordances` (`../rowCrudAffordances`), which returns
 * `CrudAffordances['editPredicates']` / `['deletePredicates']` — the spec-owned
 * `RowCrudPredicates` (ADR-0103), parsed in exactly one place
 * (`@object-ui/core`'s `normalizeUserAction`) and re-exported there from
 * `@objectstack/spec/data`. Deriving from the data-table's twins would have
 * bound this file to a schema key it never sees: a NEW wrong coupling in place
 * of the old missing one.
 *
 * The union of the two twins is deliberate, exactly as in PR #4423: every
 * consumer that reads this alias serves BOTH built-ins (`name: 'edit' |
 * 'delete'`), so it may only read keys that BOTH affordance keys declare — if
 * either twin dropped one, the read stops compiling instead of silently reading
 * `undefined`. Today the twins are declared as one named type, so the union
 * collapses onto it; the construction is what states the constraint that
 * outlives that coincidence.
 *
 * Deriving also TIGHTENS what this file accepts, and that is the point rather
 * than a side effect: the hand-written pair typed both keys `unknown`, while
 * the spec types them `Expression | ExpressionInput` — the authored CEL
 * shorthand or its `{ dialect, source }` envelope. `@object-ui/core` retired
 * the same imprecision at its own seam and said so in as many words ("The local
 * `unknown` was imprecision, not a deliberate dialect"); this was the last copy
 * of it.
 *
 * Behavior is unchanged and stays the posture `RowCrudActionOverrideSchema`
 * specifies: `visibleWhen` fails CLOSED (the item is not rendered for this row),
 * `disabledWhen` fails soft (the item renders disabled), both evaluated per row
 * on the canonical CEL engine — the same machinery as custom actions'
 * `visible` / `disabled`.
 */
export type BuiltinRowActionPredicates = NonNullable<
  CrudAffordances['editPredicates'] | CrudAffordances['deletePredicates']
>;

export interface RowActionMenuProps {
  /** The row data record */
  row: any;
  /** Custom row action identifiers (legacy, label = mechanical title-case) */
  rowActions?: string[];
  /** Full action defs — render with proper label/icon/variant from schema. */
  rowActionDefs?: RowActionDef[];
  /** Whether edit operation is available */
  canEdit?: boolean;
  /** Whether delete operation is available */
  canDelete?: boolean;
  /** Per-record predicates for the built-in Edit item (from `userActions.edit`). */
  editPredicates?: BuiltinRowActionPredicates;
  /** Per-record predicates for the built-in Delete item (from `userActions.delete`). */
  deletePredicates?: BuiltinRowActionPredicates;
  /** Callback when edit is clicked */
  onEdit?: (row: any) => void;
  /** Callback when delete is clicked */
  onDelete?: (row: any) => void;
  /** Callback when a custom row action (string id) is clicked */
  onAction?: (action: string, row: any) => void;
  /** Callback when a schema-driven row action is clicked. */
  onActionDef?: (def: RowActionDef, row: any) => void;
  /**
   * How many `variant:'primary'` row actions may render as inline buttons
   * before the rest fold into the "⋮" overflow menu. Bounds the row's inline
   * width so multiple primary actions (e.g. Open + Upgrade Plan) can't crowd
   * and clip each other in the narrow actions column. Defaults to 1.
   *
   * Counts the primaries that actually RENDER for this row, not the ones
   * declared: a primary suppressed by its own `visible` occupies no slot
   * (objectui#3762). The bound is a width budget for real buttons, so spending
   * it on an action that renders nothing helps no layout and hides the row's CTA
   * behind the "⋮".
   */
  maxInlineActions?: number;
  /**
   * The object's field definitions (`objectSchema.fields`). Passed to every
   * predicate on this row so a relation field is bound as the FOREIGN KEY the
   * server stores rather than the record `$expand` substituted for it — the
   * grid expands every relational COLUMN, which would otherwise decide whether
   * `record.owner == os.user.id` can be true (see `toPredicateRecord`).
   */
  objectFields?: unknown;
}

// ---------------------------------------------------------------------------
// Visibility — ONE definition, read by the items AND by the "⋮" guard
// ---------------------------------------------------------------------------

/**
 * Evaluate a row-action visibility predicate the way this file's items do — on
 * the canonical CEL engine, failing CLOSED with a diagnosable warning — but
 * WITHOUT a hook.
 *
 * Hook-free matters because the guard below asks this question for a VARIABLE
 * number of declared actions inside one `useMemo`; a `useRowPredicate` per
 * action would tie the hook count to `rowActionDefs.length`. Mirrors
 * `useRowPredicate(pred, row, { fallback: false, warnOnError: true, label, fields })`
 * exactly, boolean short-circuit included — a boolean handed to the engine
 * faults ("AST-only evaluation not yet supported") and fails closed, which is
 * how `visible: true` once hid a bulk button from everyone (objectui#3492; the
 * same short-circuit is spelled out at length in this package's
 * `bulkEligibility`).
 */
function evalRowActionVisibility(
  pred: unknown,
  row: any,
  scope: Record<string, unknown>,
  label: string,
  fields: unknown,
): boolean {
  if (typeof pred === 'boolean') return pred;
  // Not dead, and not the place that decides "was a gate declared?" — the two
  // callers below answer that first, each by its own rule. `''` still arrives
  // here from `isBuiltinRowActionVisible`, whose gate is `!= null` alone; a
  // nothing-to-evaluate predicate that reached an evaluator fails CLOSED like
  // any other unevaluable one.
  if (pred == null || pred === '') return false;
  return evalRowPredicate(pred as never, row ?? {}, {
    fallback: false,
    scope,
    warnOnError: true,
    label,
    fields: fields as never,
  });
}

/**
 * Does the built-in Edit/Delete item render for THIS row? The single
 * definition, read both by {@link BuiltinRowActionItem} itself and by the guard
 * that decides whether this row gets a "⋮" trigger at all.
 *
 * The two disagreeing is objectui#3562: the guard counted whether HANDLERS were
 * supplied, the items were then filtered a second time by these per-record
 * predicates, and a row with every item suppressed still grew a trigger that
 * opened an empty 128×10 box with zero `[role=menu]` children.
 *
 * `visibleWhen` counts as a declared gate by `!= null`, not by truthiness —
 * `visibleWhen: false` hides the item rather than reading as "ungated". This is
 * the item's historical rule, extracted verbatim.
 *
 * The parameter is consumption-shaped — visibility is all this decides, so
 * `disabledWhen` is deliberately absent — but `Pick`ed from the derived
 * authoring shape rather than hand-written, so it is a SUBSET of that shape by
 * construction (objectui#4429).
 */
export function isBuiltinRowActionVisible(
  predicates: Pick<BuiltinRowActionPredicates, 'visibleWhen'> | undefined,
  name: 'edit' | 'delete',
  row: any,
  scope: Record<string, unknown>,
  fields?: unknown,
): boolean {
  const pred = predicates?.visibleWhen;
  if (pred == null) return true;
  return evalRowActionVisibility(pred, row, scope, `builtin:${name}:visibleWhen`, fields);
}

/**
 * Does this schema-driven action render for THIS row? Same single-definition
 * rule as the built-ins above, and it governs BOTH surfaces a def can land on:
 * the "⋮" menu item ({@link RowActionMenuItem}) and the inline primary button
 * ({@link RowActionInlineButton}). One function, so a def cannot be visible on
 * one surface and hidden on the other.
 *
 * A gate counts as DECLARED by `!= null && !== ''`, never by truthiness
 * (objectui#3758). Truthiness cannot answer the question: `visible: false` is a
 * declared gate that excludes every row, and testing `!def.visible` classified
 * it as *ungated* — so the most explicit way to say "never show this" rendered
 * the action for everyone, on both surfaces and in the "⋮" guard's count. This
 * is `bulkEligibility`'s `hasVisibilityGate` verbatim, the invariant
 * objectui#3492 established for the selection bar, and the same `!= null`
 * posture the built-in `visibleWhen` gate above has always had. The boolean then
 * decides in {@link evalRowActionVisibility}, which short-circuits it instead of
 * handing it to the engine.
 *
 * `''` is grouped with `null` deliberately: an empty predicate is nothing to
 * evaluate, so it must not hide the action from everyone either.
 */
export function isCustomRowActionVisible(
  def: RowActionDef | undefined,
  row: any,
  scope: Record<string, unknown>,
  fields?: unknown,
): boolean {
  const pred = def?.visible;
  if (pred == null || pred === '') return true;
  return evalRowActionVisibility(pred, row, scope, def?.name ?? 'row-action', fields);
}

/** What this row's action cell will actually render. */
export interface RowActionMenuPlan {
  /**
   * The `variant:'primary'` actions rendering as inline buttons: the first
   * `maxInlineActions` primaries that SURVIVE their own `visible` for this row,
   * in declared order (objectui#3762).
   */
  inline: RowActionDef[];
  /** The built-in Edit item renders in the menu for this row. */
  edit: boolean;
  /** The built-in Delete item renders in the menu for this row. */
  remove: boolean;
  /**
   * Menu-bound defs surviving their own `visible`: the surviving primaries that
   * did not fit an inline slot, then the surviving non-primaries — each group in
   * declared order, primaries above secondaries as before.
   */
  custom: RowActionDef[];
  /** Legacy string row actions. Predicate-free, so all of them render. */
  legacy: string[];
  /**
   * Items that will render INSIDE the "⋮" menu. `0` means: render no trigger at
   * all (#3562).
   *
   * Named `menuCount` rather than the data-table plan's `count` because this
   * surface also has an inline button path, and inline buttons are NOT part of
   * the trigger's decision — a row may legitimately show an inline CTA and no
   * "⋮" (that is today's behavior for a single primary action).
   */
  menuCount: number;
}

/**
 * Resolve ONE row's action cell — which items survive their per-record
 * predicates, and how many that leaves inside the "⋮" menu.
 *
 * Per ROW, not per grid: `visibleWhen` / `visible` are per-record predicates,
 * so two rows of the same grid legitimately differ (one keeps Edit, the next
 * has nothing left). `RowActionMenu` is already instantiated per row by the
 * `_actions` column's `cell`, so the decision lives here.
 *
 * Only visibility is decided here — a `disabled` item still renders (greyed
 * out) and still COUNTS, exactly as before. That counting is pinned where it
 * can be OBSERVED, on the rendered menu, by `RowActionMenu.emptyGuard.test.tsx`'s
 * "keeps the trigger for a row whose only item renders merely DISABLED"
 * (objectui#4429) — this function never reads `disabledWhen`, so no assertion on
 * its return value can pin that claim. Capability filtering
 * (ADR-0066 D4 / framework#3923) happens upstream of this call, on the declared
 * set, so its verdict reaches the guard the same way.
 *
 * Inline slot allocation happens HERE, after visibility, and that ordering is
 * the whole of objectui#3762: an inline slot is spent only on a primary that
 * actually renders for this row. It used to be sliced off the DECLARED primaries
 * before any predicate ran, so a suppressed leading primary held a slot that
 * rendered nothing (`RowActionInlineButton` returned `null` into it) while the
 * next primary — the one that DID survive — had already been folded into the "⋮".
 * A row with exactly one visible primary and a budget of one inline button
 * showed no button and a "⋮" hiding its main CTA. Deciding survival and
 * placement in one function is also why they cannot drift: there is no second
 * place that partitions the defs.
 */
export function planRowActionMenu(input: {
  row: any;
  scope: Record<string, unknown>;
  /**
   * The row's action defs in DECLARED order, already capability-gated
   * (ADR-0066 D4) but NOT partitioned — this function splits primary from
   * non-primary and allocates the inline slots, because both decisions depend on
   * which defs survive `visible` (objectui#3762).
   */
  actionDefs?: readonly RowActionDef[];
  /**
   * Inline-button budget, i.e. how many SURVIVING primaries render inline before
   * the rest fold into the menu. Defaults to 1, matching
   * {@link RowActionMenuProps.maxInlineActions}; negative values are clamped to 0.
   */
  maxInlineActions?: number;
  /** Legacy string row actions (no predicates). */
  rowActions?: readonly string[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: unknown;
  onDelete?: unknown;
  /**
   * The predicate parameters are consumption-shaped — this function reads
   * `visibleWhen` and nothing else, and the signatures keep saying so — but each
   * is `Pick`ed from the exact affordance key its production caller passes
   * (`ObjectGrid` → `resolveRowCrudAffordances`), rather than hand-restated
   * (objectui#4429). Same subset as before, minus the drift: a rename in the
   * spec-owned `RowCrudPredicates` fails here at compile time instead of leaving
   * a stale hand-copy that still type-checks against nothing.
   */
  editPredicates?: Pick<NonNullable<CrudAffordances['editPredicates']>, 'visibleWhen'>;
  deletePredicates?: Pick<NonNullable<CrudAffordances['deletePredicates']>, 'visibleWhen'>;
  objectFields?: unknown;
}): RowActionMenuPlan {
  const { row, scope, objectFields } = input;
  const edit = Boolean(input.canEdit && input.onEdit)
    && isBuiltinRowActionVisible(input.editPredicates, 'edit', row, scope, objectFields);
  const remove = Boolean(input.canDelete && input.onDelete)
    && isBuiltinRowActionVisible(input.deletePredicates, 'delete', row, scope, objectFields);
  // One `visible` evaluation per def, as before — the partition below is pure
  // array work on the survivors, so honoring the fix costs nothing extra.
  const surviving = (input.actionDefs ?? []).filter(
    (def) => isCustomRowActionVisible(def, row, scope, objectFields),
  );
  const survivingPrimaries = surviving.filter((def) => def.variant === 'primary');
  const inlineBudget = Math.max(0, input.maxInlineActions ?? 1);
  const inline = survivingPrimaries.slice(0, inlineBudget);
  const custom = [
    // Primaries that outran the inline budget stay above the secondaries, the
    // menu order this surface has always had.
    ...survivingPrimaries.slice(inlineBudget),
    ...surviving.filter((def) => def.variant !== 'primary'),
  ];
  const legacy = [...(input.rowActions ?? [])];
  return {
    inline,
    edit,
    remove,
    custom,
    legacy,
    menuCount: (edit ? 1 : 0) + (remove ? 1 : 0) + custom.length + legacy.length,
  };
}

/**
 * One schema-driven row-action menu item. Extracted into its own component
 * so the `visible` CEL predicate can be evaluated with a hook
 * (`useCondition`) without violating the rules-of-hooks inside a `.map()`.
 * Mirrors `ActionMenuItem` on the record_header path: when a `visible`
 * predicate is present and evaluates false against the row, the item is
 * hidden (so e.g. "Resume" no longer shows on a running record). Bare field
 * references (`status == "active"`, `is_default != true`) resolve against
 * the row record passed in as evaluation context.
 */
const RowActionMenuItem: React.FC<{
  def: RowActionDef;
  row: any;
  objectFields?: unknown;
  onActionDef?: (def: RowActionDef, row: any) => void;
}> = ({ def, row, objectFields, onActionDef }) => {
  // Evaluate predicates against the row on the canonical CEL engine (issue
  // #1584): the row is bound both bare (`status`) and as `record.status`, and
  // the ambient `features`/`user` scope is merged. `visible` fails CLOSED
  // (hidden + warn) so a broken predicate can't silently expose an action —
  // matching ActionEngine's posture; `disabled` fails soft (not disabled).
  //
  // `visible` goes through the shared `isCustomRowActionVisible` — the SAME
  // function the guard in `RowActionMenu` counts with, so an item can never be
  // suppressed behind a "⋮" trigger that survived (objectui#3562).
  const scope = usePredicateScope();
  const isVisible = React.useMemo(
    () => isCustomRowActionVisible(def, row, scope, objectFields),
    [def, row, scope, objectFields],
  );
  const isDisabled = useRowPredicate((def as any).disabled, row, { fallback: false, warnOnError: true, label: `${def.name}:disabled`, fields: objectFields });
  if (!isVisible) return null;
  return (
    <DropdownMenuItem
      disabled={isDisabled}
      onClick={() => { if (!isDisabled) onActionDef?.(def, row); }}
      data-testid={`row-action-${def.name}`}
      className={def.variant === 'danger' ? 'text-destructive focus:text-destructive' : undefined}
    >
      {def.label ?? formatActionLabel(def.name)}
    </DropdownMenuItem>
  );
};

/**
 * A built-in Edit/Delete menu item gated by per-record CEL predicates
 * (objectui#2614). Extracted into a component so `useRowPredicate` runs
 * hook-safe, mirroring `RowActionMenuItem` for custom actions. Note the
 * evaluation is naturally lazy: this only renders inside the (Radix)
 * `DropdownMenuContent`, which mounts when the row's "⋮" menu opens — so
 * declaring predicates costs nothing while the grid renders.
 *
 * Posture matches the spec contract (`RowCrudActionOverrideSchema`):
 * `visibleWhen` fails CLOSED (a faulting predicate hides + warns once, so a
 * broken predicate can't expose an affordance the author meant to gate);
 * `disabledWhen` fails soft (button stays enabled — the server hook is the
 * real enforcement).
 */
export const BuiltinRowActionItem: React.FC<{
  name: 'edit' | 'delete';
  /**
   * The whole authoring shape, because this component reads BOTH keys —
   * derived from the affordance type rather than hand-copied (objectui#4429).
   * This is the site with the most to gain: a hand-copy that keeps one key in
   * common with a renamed source satisfies TS weak-type detection and drifts
   * with ZERO diagnostics (measured on the data-table twin in PR #4423).
   */
  predicates?: BuiltinRowActionPredicates;
  row: any;
  icon: React.ReactNode;
  label: string;
  className?: string;
  objectFields?: unknown;
  onSelect: (row: any) => void;
}> = ({ name, predicates, row, icon, label, className, objectFields, onSelect }) => {
  // `visibleWhen` is read through the shared `isBuiltinRowActionVisible`, the
  // same function the "⋮" guard counts with — see objectui#3562.
  const scope = usePredicateScope();
  const isVisible = React.useMemo(
    () => isBuiltinRowActionVisible(predicates, name, row, scope, objectFields),
    [predicates, name, row, scope, objectFields],
  );
  const isDisabled = useRowPredicate(predicates?.disabledWhen, row, {
    fallback: false,
    warnOnError: true,
    label: `builtin:${name}:disabledWhen`,
    fields: objectFields,
  });
  if (!isVisible) return null;
  const disabled = predicates?.disabledWhen != null && isDisabled;
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={() => { if (!disabled) onSelect(row); }}
      data-testid={`row-action-builtin-${name}`}
      className={className}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );
};

/** Map a schema action variant onto a Button variant. `primary` is the
 * accent ("default") button so the action reads as the row's main CTA. */
function toButtonVariant(v: RowActionDef['variant']): 'default' | 'secondary' | 'destructive' | 'ghost' | 'link' {
  switch (v) {
    case 'danger': return 'destructive';
    case 'secondary': return 'secondary';
    case 'ghost': return 'ghost';
    case 'link': return 'link';
    default: return 'default'; // 'primary' (and unset) → accent button
  }
}

/**
 * A `variant: 'primary'` row action rendered as an inline button (not folded
 * into the "⋮" overflow), so the row's main CTA — e.g. "Open" on an
 * environment — is immediately visible and clickable. Hook-safe per item so
 * the `visible` CEL predicate is honored just like the menu path.
 *
 * "Just like the menu path" is now literal rather than parallel prose: the
 * predicate is read through the shared `isCustomRowActionVisible`, so a primary
 * action whose `visible` fails for this row cannot render inline while the same
 * def would be hidden in the menu (objectui#3562, the inline half of the same
 * single-source rule).
 */
const RowActionInlineButton: React.FC<{
  def: RowActionDef;
  row: any;
  objectFields?: unknown;
  onActionDef?: (def: RowActionDef, row: any) => void;
}> = ({ def, row, objectFields, onActionDef }) => {
  const scope = usePredicateScope();
  const isVisible = React.useMemo(
    () => isCustomRowActionVisible(def, row, scope, objectFields),
    [def, row, scope, objectFields],
  );
  if (!isVisible) return null;
  return (
    <Button
      variant={toButtonVariant(def.variant)}
      size="sm"
      className="h-8"
      data-testid={`row-action-inline-${def.name}`}
      onClick={(e) => { e.stopPropagation(); onActionDef?.(def, row); }}
    >
      {def.label ?? formatActionLabel(def.name)}
    </Button>
  );
};

export const RowActionMenu: React.FC<RowActionMenuProps> = ({
  row,
  rowActions,
  rowActionDefs,
  canEdit,
  canDelete,
  editPredicates,
  deletePredicates,
  onEdit,
  onDelete,
  onAction,
  onActionDef,
  maxInlineActions = 1,
  objectFields,
}) => {
  const t = useRowActionTranslation();
  // [ADR-0066 D4 / framework#3923] Capability gate, applied ONCE to the whole
  // declared set so the inline CTA, the overflow menu and `hasMenu` all agree.
  // This surface filters its own actions instead of going through
  // `ActionEngine.getActionsForLocation`, so the engine's gate never reached
  // `list_item` — a row action declaring a capability nobody holds still
  // rendered. Unknown capabilities fail OPEN (see `useCapabilityGate`); the
  // server remains the authority.
  const mayInvoke = useCapabilityGate();
  const gatedActionDefs = React.useMemo(
    () => (rowActionDefs ?? []).filter(d => mayInvoke((d as any)?.requiredPermissions)),
    [rowActionDefs, mayInvoke],
  );
  // What this row will ACTUALLY render, per-record predicates applied — the
  // guard and the items read one visibility source, so they cannot disagree.
  //
  // `variant: 'primary'` actions surface inline (as the row's main CTA) and
  // everything else stays in the "⋮" overflow menu; only `maxInlineActions` of
  // them render inline, so a row never shows more inline buttons than the actions
  // column can fit — which previously clipped the leftmost button ("Open" hidden
  // behind "Upgrade Plan"). That partition lives inside `planRowActionMenu`
  // rather than here (objectui#3762) precisely because the budget must be spent
  // on the primaries that SURVIVE this row's predicates: slicing the declared
  // primaries first left a suppressed one holding an empty slot while the
  // surviving next primary was already folded behind the "⋮".
  //
  // objectui#3562: the old guard asked whether handlers were supplied and how
  // many actions were DECLARED (`(canEdit && onEdit) || … || menuDefs.length > 0`
  // — `menuDefs` being the pre-partitioned slice that #3762 moved into the plan),
  // while the items were filtered a second time, per row, by `visibleWhen` /
  // `visible`. Handlers present + every item suppressed for this record = a "⋮"
  // that opens an empty box — measured at 128×10 with zero `[role=menu]`
  // children on `sys_approval_request`, whose `list_item` actions (approve /
  // reject / recall) are gated for approvers and fail for an admin browsing the
  // "全部" view. The capability gate above was already folded in for exactly
  // this reason (#3923); the per-record predicates were not.
  const scope = usePredicateScope();
  const plan = React.useMemo(
    () =>
      planRowActionMenu({
        row,
        scope,
        actionDefs: gatedActionDefs,
        maxInlineActions,
        rowActions,
        canEdit,
        canDelete,
        onEdit,
        onDelete,
        editPredicates,
        deletePredicates,
        objectFields,
      }),
    [
      row,
      scope,
      gatedActionDefs,
      maxInlineActions,
      rowActions,
      canEdit,
      canDelete,
      onEdit,
      onDelete,
      editPredicates,
      deletePredicates,
      objectFields,
    ],
  );
  // Nothing left to show → no trigger. An affordance that opens empty reads as
  // a broken page, which is the whole of #3562. The wrapper `<div>` is still
  // returned, so the `_actions` cell stays present and every row keeps the same
  // `<td>` count — a row with nothing to offer renders an empty cell, the shape
  // a grid with no actions at all has always produced.
  const hasMenu = plan.menuCount > 0;
  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {plan.inline.map(def => (
        <RowActionInlineButton
          key={def.name}
          def={def}
          row={row}
          objectFields={objectFields}
          onActionDef={onActionDef}
        />
      ))}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              data-testid="row-action-trigger"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t('grid.openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {/* Rendered off the PLAN, the same object the trigger's existence
                was decided from — the items and the "⋮" cannot drift apart
                (#3562). Each item component re-reads the shared visibility
                function too, so it stays correct when used standalone. */}
            {plan.edit && (
              <BuiltinRowActionItem
                name="edit"
                predicates={editPredicates}
                row={row}
                icon={<Edit className="mr-2 h-4 w-4" />}
                label={t('grid.edit')}
                objectFields={objectFields}
                onSelect={(r) => onEdit?.(r)}
              />
            )}
            {plan.remove && (
              <BuiltinRowActionItem
                name="delete"
                predicates={deletePredicates}
                row={row}
                icon={<Trash2 className="mr-2 h-4 w-4" />}
                label={t('grid.delete')}
                objectFields={objectFields}
                onSelect={(r) => onDelete?.(r)}
              />
            )}
            {plan.custom.map(def => (
              <RowActionMenuItem
                key={def.name}
                def={def}
                row={row}
                objectFields={objectFields}
                onActionDef={onActionDef}
              />
            ))}
            {plan.legacy.map(action => (
              <DropdownMenuItem
                key={action}
                onClick={() => onAction?.(action, row)}
                data-testid={`row-action-${action}`}
              >
                {formatActionLabel(action)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
