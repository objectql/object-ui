/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * declaredActionDispatch — turn ONE server-declared object action into the
 * dispatch object the console action runtime executes.
 *
 * A declared action (`objectDef.actions[]`) is authored against a *record*, not
 * against a surface: `type:'api'` with a `{id}`-interpolated target, a `params`
 * array the param dialog collects, and `label`/`confirmText`/`successMessage`
 * literals that localize through the `_actions.<name>.*` convention. Getting
 * from that declaration to a runnable dispatch takes four steps that every
 * surface must perform identically, or the same action behaves differently
 * depending on where it was clicked:
 *
 *   1. the record moves to `params._rowRecord` — the key the api handler reads
 *      to interpolate `{id}` and inject a record id;
 *   2. the declared `params` ARRAY moves to `actionParams` — the key the runner
 *      reads for its param dialog (`params` is now the row stash);
 *   3. an approval decision additionally contributes one synthesized
 *      `outputs.<key>` param per output the *request* declares (framework#3447)
 *      — a per-request key set that can never be a static action param;
 *   4. the declared strings are localized through `_actions.<name>.*`.
 *
 * This is that one implementation. `DeclaredActionsBar` (the approvals inbox)
 * and the record page's approval header both build their dispatch here, which
 * is what makes a decision taken from a business record identical to the same
 * decision taken from the Approval Center — objectui#3055.
 */

import type { ActionDef } from '@object-ui/core';
import { decisionOutputDefs, decisionOutputParams } from './decisionOutputParams';

/**
 * The `_actions.<name>.*` resolvers (from `useObjectLabel`) plus the plain
 * translator `t` used for the strings the surface itself synthesizes.
 */
export interface DeclaredActionI18n {
  actionLabel: (objectName: string | undefined, actionName: string, fallback: string) => string;
  actionConfirm: (objectName: string | undefined, actionName: string, fallback?: string) => string | undefined;
  actionSuccess: (objectName: string | undefined, actionName: string, fallback?: string) => string | undefined;
  /** Localizes the synthesized decision-output help text (objectui#2762 P0-3). */
  t: (key: string, opts?: any) => string;
}

/**
 * Which approval decision a declared action records, read off its REST target.
 *
 * Only `approve` / `reject` carry decision outputs, and only `approve` enforces
 * a `required` one — the server rejects a blank required output on approve and
 * never on reject, so the two dialogs differ in exactly that flag.
 */
export function declaredDecision(target: unknown): 'approve' | 'reject' | undefined {
  const s = String(target ?? '');
  if (/\/approve$/.test(s)) return 'approve';
  if (/\/reject$/.test(s)) return 'reject';
  return undefined;
}

/**
 * Shape a declared action + its record into an `execute()`-ready dispatch.
 *
 * Pure — no hooks, no fetching — so a surface can build the dispatch eagerly
 * (the record header renders the dispatch object itself and hands it straight
 * to `execute` on click) or lazily at click time.
 */
export function buildDeclaredActionDispatch(
  action: ActionDef,
  opts: { objectName: string; record: unknown; i18n: DeclaredActionI18n },
): ActionDef {
  const { objectName, record, i18n } = opts;
  const recordData = record != null && typeof record === 'object'
    ? (record as Record<string, any>)
    : {};
  // Forward the full def (type/target/recordIdParam/bodyShape/refreshAfter/…);
  // `params` is peeled off because it means something different downstream.
  const { params: rawParams, ...rest } = action as ActionDef & { params?: unknown };
  const decision = declaredDecision((action as any).target);
  // Widget mapping (typed picker vs free text) lives in the shared helper, so
  // every decision surface renders the same controls (objectui#2955).
  const outputParams = decision
    ? decisionOutputParams(decisionOutputDefs(recordData), i18n.t, { decision })
    : [];

  const dispatch: any = {
    ...rest,
    // Localized copies ride the dispatch: the runner reads `label` for the
    // param-dialog title, `confirmText` for the confirm prompt and
    // `successMessage` for the toast. A nameless action has no translation
    // key, so it keeps its literal strings.
    ...(action.name && {
      label: i18n.actionLabel(objectName, action.name, action.label || action.name),
      ...(rest.confirmText !== undefined && {
        confirmText: i18n.actionConfirm(objectName, action.name, (rest as any).confirmText),
      }),
      ...(rest.successMessage !== undefined && {
        successMessage: i18n.actionSuccess(objectName, action.name, (rest as any).successMessage),
      }),
    }),
    objectName,
    params: { _rowRecord: record },
  };
  const staticParams = Array.isArray(rawParams) ? rawParams : [];
  if (staticParams.length > 0 || outputParams.length > 0) {
    dispatch.actionParams = [...staticParams, ...outputParams];
  }
  return dispatch as ActionDef;
}
