/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Resolve a list view's `bulkActions: string[]` against the object's declared
 * actions, folding each resolvable name into the rich `BulkActionDef` list the
 * selection bar renders.
 *
 * This is the selection-scoped twin of {@link resolveLegacyRowActions}
 * (objectui#2960 / #2996), and it closes the same `{type: <name>}` dead end on
 * the bulk path (objectui#3002): dispatching `bulkActions: ['push_down']` put
 * the action's NAME in the runner's `type` slot, which resolves to nothing —
 * zero requests, and (since #2996) a loud failure instead of a green toast.
 *
 * ## Where a bulk action is declared
 *
 * **In the VIEW's `bulkActions`, naming an action the object declares.** That
 * is the whole vocabulary. `ActionSchema.bulkEnabled` looked like an
 * object-level alternative and this module briefly derived from it, but spec
 * 17.0.0 retired the key (#3896 close-out / framework#4054) — it is now a
 * `retiredKey()` tombstone, so authoring it is a HARD parse rejection whose
 * own prescription is: *"the multi-select toolbar is driven by the LIST VIEW's
 * `bulkActions` / `bulkActionDefs`, never by this flag … declare the action in
 * the view's `bulkActions` instead."* Do not reintroduce a `bulkEnabled` read
 * here: `defineStack` refuses to compile a config that sets it, so the branch
 * can never run.
 *
 * `locations` stays orthogonal — it places an action's SINGLE-record entry
 * (toolbar / row kebab / record header). One action can be both: declared
 * `locations: ['list_item']` AND named in `bulkActions`, it runs on one row
 * from the kebab and on N rows from the selection bar.
 *
 * ## Two vocabularies reach the selection bar
 *
 *  1. `bulkActionDefs` — rich defs authored inline in the view JSON. Left
 *     as-authored, with ONE narrowly-scoped exception: a def carrying
 *     `execution: 'aggregate'` and no inline `actionDef` resolves its `name`
 *     against `objectDef.actions` and gets the matched action attached (see
 *     below). They own their names and win every collision either way.
 *  2. `bulkActions: string[]` — bare action names, resolved against
 *     `objectDef.actions` and PROMOTED to that def, so they carry the action's
 *     label, icon, `visible` predicate, `requiredPermissions` gate, confirm text
 *     and params instead of a bare humanized name. The bare-string form always promotes to the
 *     per-record dispatch — it has nowhere to carry an `execution` flag, so
 *     aggregate mode (objectui#3139) requires the authored-def form above.
 *
 * A promoted def carries `operation: 'custom'` plus the source action under
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
 * Concurrency for a promoted action's per-record fan-out. Well below the
 * `BulkActionDef` default (200) because each record here is a distinct runner
 * dispatch — typically an HTTP call to a custom endpoint or a flow run, not a
 * single batched data-API write. 200 in flight would be a thundering herd
 * against an endpoint that never opted into bulk traffic.
 */
export const PROMOTED_BULK_BATCH_SIZE = 25;

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
  // `confirmText` only. The structured `confirm.message` fallback that used to
  // sit here is retired (objectui#4314): spec's action surface carries no
  // structured confirm, so the branch read a key `objectDef.actions` can never
  // deliver — and tolerating it kept a second confirm dialect alive (#0.1).
  const confirmText = typeof action.confirmText === 'string' ? action.confirmText : undefined;
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
    // [ADR-0066 D4 / objectui#3492] The capability gate travels with the action.
    // Dropping it here is what let a `requiredPermissions` action that the row
    // kebab hides reappear in the selection bar: the bar has no other route to
    // the declaration, since it renders defs, not `ActionDef`s.
    ...(Array.isArray(action.requiredPermissions) && {
      requiredPermissions: action.requiredPermissions as string[],
    }),
    batchSize: PROMOTED_BULK_BATCH_SIZE,
    actionDef: action,
  };
}

export function resolveBulkActions(opts: {
  /**
   * The view's `bulkActions` names, already stripped of the canonical
   * `'delete'` entry (it routes to the grid's `onBulkDelete`, not the runner —
   * same carve-out the row fold makes for `'edit'` / `'delete'`).
   */
  bulkActions?: readonly string[] | null;
  /** Rich defs authored inline in the view/list JSON. */
  bulkActionDefs?: readonly BulkActionDef[] | null;
  /** Every action declared on the object (`objectDef.actions`). */
  objectActions?: readonly NamedActionDef[] | null;
  /**
   * Resolves a promoted def's label through the app's i18n bundle, so a bulk
   * action reads the same in the selection bar as its row entry does in the
   * kebab. Omit to use the authored label verbatim.
   */
  localizeLabel?: ActionLabelResolver;
}): {
  /**
   * Authored defs, then the promoted names in `bulkActions` order. Returned by
   * REFERENCE when nothing was promoted, so a view with no names to fold keeps
   * its identity across renders.
   */
  defs: readonly BulkActionDef[];
  /** Names that matched no declared action; dispatched by name. */
  unresolved: string[];
} {
  const rawAuthored = Array.isArray(opts.bulkActionDefs) ? opts.bulkActionDefs : [];
  const names = Array.isArray(opts.bulkActions) ? opts.bulkActions : [];
  const objectActions = Array.isArray(opts.objectActions) ? opts.objectActions : [];

  // [#3139] An authored def opting into the aggregate dispatch usually just
  // NAMES a declared object action (`{ name, operation: 'custom', execution:
  // 'aggregate' }`) instead of duplicating it inline. Resolve that name and
  // attach the action as `actionDef` — merged so authored keys win — because
  // `useBulkExecutor` dispatches nothing without one. Scoping the merge to an
  // EXPLICIT `execution: 'aggregate'` (with no inline `actionDef`) is what
  // keeps it safe: a plain authored `custom` def that happens to share a name
  // with an object action keeps its historical no-op/callout meaning. The
  // promoted `batchSize` is dropped — an aggregate run is one call by
  // contract, never chunked.
  const wantsAggregateResolve = (def: BulkActionDef | undefined | null): boolean =>
    !!def
    && def.execution === 'aggregate'
    && def.operation === 'custom'
    && !def.actionDef
    && typeof def.name === 'string'
    && def.name !== '';
  // Mapped only when at least one def qualifies, so the common case keeps the
  // authored array's referential identity (see the `defs` return doc).
  const authored = rawAuthored.some(wantsAggregateResolve)
    ? rawAuthored.map((def) => {
        if (!wantsAggregateResolve(def)) return def;
        const match = objectActions.find(a => a?.name === def.name);
        if (!match) return def;
        const { batchSize: _batchSize, ...promoted } = toBulkActionDef(match, opts.localizeLabel);
        return { ...promoted, ...def };
      })
    : rawAuthored;

  const claimed = new Set(
    authored.map(d => d?.name).filter((n): n is string => typeof n === 'string' && n !== ''),
  );

  const promoted: BulkActionDef[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    if (typeof name !== 'string' || name === '') continue;
    // Already surfaced (an authored def of the same name, or an earlier pass
    // over a repeated entry) — drop the duplicate rather than render a twin.
    // Both outcomes claim the name: the bar keys its buttons on it, so even
    // two dead-name entries would collide.
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
    defs: promoted.length > 0 ? [...authored, ...promoted] : authored,
    unresolved,
  };
}
