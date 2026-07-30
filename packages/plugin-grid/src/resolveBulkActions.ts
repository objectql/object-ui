/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Fold an object's declared actions — and a list view's legacy
 * `bulkActions: string[]` — into the rich `BulkActionDef` list the selection
 * bar renders.
 *
 * This is the selection-scoped twin of {@link resolveLegacyRowActions}
 * (objectui#2960 / #2996), and it closes the same `{type: <name>}` dead end on
 * the bulk path (objectui#3002): dispatching `bulkActions: ['push_down']` put
 * the action's NAME in the runner's `type` slot, which resolves to nothing.
 *
 * ## Where an object-level bulk action is declared
 *
 * `ActionSchema.bulkEnabled` — *"Whether this action can be applied to
 * multiple selected records"*. The spec has carried this flag all along; what
 * was missing was a consumer (framework's own liveness audit: *"engine has
 * `getBulkActions`/`executeBulk`, but no spec-driven view path calls
 * `executeBulk`"*). So no new `locations` entry is needed — a list selection
 * bar is the only surface on which records are multi-selected, which is
 * exactly what the flag already names. `locations` stays orthogonal: it places
 * an action's SINGLE-record entry (toolbar / row kebab / record header), and
 * an action may carry both (`locations: ['list_item'], bulkEnabled: true` =
 * runs on one row from the kebab, on N rows from the selection bar).
 *
 * ## Three vocabularies reach the selection bar
 *
 *  1. `bulkActionDefs` — rich defs authored inline in the view JSON. Untouched
 *     here; they own their names and win every collision.
 *  2. `objectDef.actions` with `bulkEnabled: true` — DERIVED into defs by this
 *     fold. This is what "declare a bulk action on the object" now means.
 *  3. `bulkActions: string[]` — the legacy bare-name form, kept as a
 *     view-level override (name an action the object didn't flag, or order it
 *     explicitly). Resolved against `objectDef.actions` by name.
 *
 * A derived def carries `operation: 'custom'` plus the source action under
 * {@link BulkActionDef.actionDef}: it is NOT a data-plane mass update, it is
 * one action run over N records through the action runner. `useBulkExecutor`
 * routes on exactly that key — a `custom` def WITHOUT `actionDef` keeps its
 * historical no-op-per-row meaning (callout handled by the consumer's
 * `onComplete`).
 *
 * Names that resolve to nothing stay in `unresolved` and are still dispatched
 * by name: consumers may have registered a runner handler under exactly that
 * name (`runner.registerHandler('my_action', …)`), and that path must keep
 * working. When no such handler exists the runner reports the dead end rather
 * than toasting success (#2996).
 */

import type { BulkActionDef, BulkActionParam } from '@object-ui/types';

/** The subset of an `ActionDef` this fold reads; everything else is carried. */
export interface NamedActionDef {
  name?: string;
  [key: string]: unknown;
}

/**
 * Concurrency for a derived action's per-record fan-out. Well below the
 * `BulkActionDef` default (200) because each record here is a distinct runner
 * dispatch — typically an HTTP call to a custom endpoint or a flow run, not a
 * single batched data-API write. 200 in flight would be a thundering herd
 * against an endpoint that never opted into bulk traffic.
 */
export const DERIVED_BULK_BATCH_SIZE = 25;

/** Action `variant`s that have no `BulkActionDef` counterpart are dropped. */
const BULK_VARIANTS = new Set(['primary', 'secondary', 'danger', 'ghost']);

/**
 * Map a spec `ActionParam` onto the dialog's `BulkActionParam`. The two carry
 * the same information under different key names — collecting the values ONCE
 * in the bulk dialog is the whole point, so the runner must not be handed the
 * param defs again (it would re-prompt per record).
 */
function toBulkParam(p: Record<string, unknown>): BulkActionParam | null {
  const name = (typeof p.name === 'string' && p.name) || (typeof p.field === 'string' && p.field) || '';
  if (!name) return null;
  const out: BulkActionParam = {
    ...p,
    name,
    type: typeof p.type === 'string' ? p.type : 'text',
  };
  if (typeof p.label === 'string') out.label = p.label;
  if (typeof p.helpText === 'string') out.help = p.helpText;
  if (p.defaultValue !== undefined) out.default = p.defaultValue;
  // `reference` is the spec spelling of the lookup target; the dialog reads `object`.
  if (typeof p.reference === 'string') out.object = p.reference;
  return out;
}

/** Resolves an action's display label through the app's i18n bundle. */
export type ActionLabelResolver = (actionName: string, fallback: string) => string;

/** Build the selection-bar def for an object action. */
function toBulkActionDef(action: NamedActionDef, localize?: ActionLabelResolver): BulkActionDef {
  const name = String(action.name);
  const rawParams = Array.isArray(action.params) ? action.params : [];
  const params = rawParams
    .map(p => (p && typeof p === 'object' ? toBulkParam(p as Record<string, unknown>) : null))
    .filter((p): p is BulkActionParam => p !== null);
  const variant = typeof action.variant === 'string' && BULK_VARIANTS.has(action.variant)
    ? (action.variant as BulkActionDef['variant'])
    : undefined;
  const confirmText =
    typeof action.confirmText === 'string'
      ? action.confirmText
      : typeof (action.confirm as { message?: unknown } | undefined)?.message === 'string'
        ? String((action.confirm as { message: string }).message)
        : undefined;
  // A non-string `I18nLabel` (the `{ en, zh }` map form) is dropped rather than
  // forwarded: the bar renders `def.label` as a React child, so an object here
  // would take the page down. Falling through to `formatActionLabel(name)`
  // matches how the grid treats a non-string column label.
  const rawLabel = typeof action.label === 'string' ? action.label : undefined;
  const label = localize ? localize(name, rawLabel ?? name) : rawLabel;

  return {
    name,
    ...(label !== undefined && { label }),
    ...(typeof action.icon === 'string' && { icon: action.icon }),
    ...(variant && { variant }),
    // Not an `update`/`delete` mass mutation — the source action owns what it
    // does. `actionDef` below is what makes this run (see useBulkExecutor).
    operation: 'custom',
    ...(params.length > 0 && { params }),
    ...(confirmText !== undefined && { confirmText }),
    ...(action.visible != null && { visible: action.visible as BulkActionDef['visible'] }),
    batchSize: DERIVED_BULK_BATCH_SIZE,
    actionDef: action,
  };
}

export function resolveBulkActions(opts: {
  /**
   * Legacy `bulkActions` names, already stripped of the canonical `'delete'`
   * entry (it routes to the grid's `onBulkDelete`, not the runner — same
   * carve-out the row fold makes for `'edit'` / `'delete'`).
   */
  bulkActions?: readonly string[] | null;
  /** Rich defs authored inline in the view/list JSON. */
  bulkActionDefs?: readonly BulkActionDef[] | null;
  /** Every action declared on the object (`objectDef.actions`). */
  objectActions?: readonly NamedActionDef[] | null;
  /**
   * Resolves a derived def's label through the app's i18n bundle, so an
   * object-declared bulk action reads the same in the selection bar as its row
   * entry does in the kebab. Omit to use the authored label verbatim.
   */
  localizeLabel?: ActionLabelResolver;
}): {
  /**
   * Authored defs, then the object's `bulkEnabled` actions, then promoted
   * legacy names. Returned by REFERENCE when nothing was derived or promoted,
   * so a view with no object actions to fold keeps its identity across renders.
   */
  defs: readonly BulkActionDef[];
  /** Legacy names that matched no declared action; dispatched by name. */
  unresolved: string[];
} {
  const authored = Array.isArray(opts.bulkActionDefs) ? opts.bulkActionDefs : [];
  const names = Array.isArray(opts.bulkActions) ? opts.bulkActions : [];
  const objectActions = Array.isArray(opts.objectActions) ? opts.objectActions : [];

  const claimed = new Set(
    authored.map(d => d?.name).filter((n): n is string => typeof n === 'string' && n !== ''),
  );

  // (2) The object's own declaration: `bulkEnabled: true`.
  const derived: BulkActionDef[] = [];
  for (const action of objectActions) {
    if (action?.bulkEnabled !== true) continue;
    const name = action?.name;
    if (typeof name !== 'string' || name === '') continue;
    if (claimed.has(name)) continue;
    claimed.add(name);
    derived.push(toBulkActionDef(action, opts.localizeLabel));
  }

  // (3) The view-level legacy override.
  const promoted: BulkActionDef[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    if (typeof name !== 'string' || name === '') continue;
    // Already surfaced (authored, derived, or an earlier pass over a repeated
    // legacy entry) — drop the duplicate rather than render a twin. Both
    // outcomes claim the name: the bar keys its buttons on it, so even two
    // dead-name entries would collide.
    if (claimed.has(name)) continue;
    claimed.add(name);
    const match = objectActions.find(a => a?.name === name);
    if (match) {
      promoted.push(toBulkActionDef(match, opts.localizeLabel));
    } else {
      unresolved.push(name);
    }
  }

  return {
    defs: derived.length > 0 || promoted.length > 0
      ? [...authored, ...derived, ...promoted]
      : authored,
    unresolved,
  };
}
