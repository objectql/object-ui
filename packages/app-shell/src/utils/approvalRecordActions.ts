/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * approvalRecordActions — mirror `sys_approval_request`'s SERVER-DECLARED
 * actions onto the header of the business record they gate (objectui#3055).
 *
 * The approvals plugin declares every decision as object metadata on
 * `sys_approval_request` (approve / reject / reassign / send back / request
 * info / remind / recall / resubmit — objectui#2678 P2-4), each with its params,
 * its confirm copy and a `visible` CEL gated on the server-computed `viewer`
 * block (framework#3310 / #3424). The Approval Center renders them through
 * `DeclaredActionsBar` and gets all nine for free.
 *
 * The business record page used to hand-wire its own Approve / Reject pair
 * instead, off a CLIENT-side `pending_approvers.includes(currentUserId)` test.
 * That second implementation was both smaller and wrong: transfer / send back /
 * request info had no entry point at all, decisions carried no attachments, the
 * copy drifted from the Approval Center's — and a group approver (position /
 * team / department) saw NO decision buttons, because the client test can never
 * match what the server resolved the group to.
 *
 * So the record page renders the same declared actions instead. What this module
 * owns is the surface mapping — everything else is the shared declared-action
 * path (`buildDeclaredActionDispatch`), which is the point:
 *
 *   • **Location.** `sys_approval_request` declares its actions at
 *     `record_section` (its own detail surface) and, for the two primary
 *     decisions, `list_item` (compact row surface). The host record header has
 *     the same two tiers, so the compact set maps to `record_header` (inline
 *     buttons) and the rest to `record_more` (the header's ⋯ overflow) —
 *     Approve / Reject stay the visible CTAs, the other levers become
 *     discoverable instead of unreachable.
 *
 *   • **Predicates.** `visible` / `hidden` / `disabled` are evaluated HERE,
 *     against the approval request, because the header evaluates predicates
 *     against the *host* record — which carries no `viewer` block, so every
 *     approval predicate would fail closed there. They are then stripped from
 *     the emitted action so the header can't re-evaluate them against the wrong
 *     record. Fail-closed on a fault is preserved (`fallback: false`), which is
 *     also what hides these actions on a backend too old to send `viewer`.
 *
 *   • **Order.** A live approval is THE thing the viewer came to act on, so the
 *     decisions outrank the object's own `record_header` actions rather than
 *     being appended after them. Strongly negative `order` values float them
 *     into the primary slots; the header stable-sorts by `order`, so app
 *     actions keep their relative order just after (#2670 / objectui#2339).
 */

import { evalRowPredicate } from '@object-ui/core';
import type { ActionDef } from '@object-ui/core';
import { buildDeclaredActionDispatch, type DeclaredActionI18n } from './declaredActionDispatch';

/** The object whose declared actions the record header mirrors. */
export const APPROVAL_REQUEST_OBJECT = 'sys_approval_request';

/**
 * Declared location that maps to an INLINE header button. `list_item` is the
 * compact row surface, so an action declared there is one the author considers
 * primary enough to render without a menu.
 */
const INLINE_LOCATION = 'list_item';

/** Declared location that maps to the header's ⋯ overflow menu. */
const OVERFLOW_LOCATION = 'record_section';

/**
 * First `order` assigned to a mirrored approval action. Low enough that the
 * decisions precede any app-authored `record_header` action (which default to
 * `order: 0`), and spaced by declaration order so Approve stays first.
 */
export const APPROVAL_HEADER_ORDER_BASE = -100;

/** Declared keys this module resolves itself and must not pass through. */
const RESOLVED_HERE = ['visible', 'hidden', 'disabled', 'locations'] as const;

/** Evaluate a spec predicate against the approval request. Fails CLOSED. */
function resolvePredicate(
  pred: unknown,
  request: Record<string, any>,
  scope: Record<string, unknown> | undefined,
  label: string,
): boolean {
  if (typeof pred === 'boolean') return pred;
  return evalRowPredicate(pred as any, request, {
    fallback: false,
    scope,
    warnOnError: true,
    label,
  });
}

export interface ApprovalRecordHeaderActionOptions {
  /** `sys_approval_request`'s declared actions (`objectDef.actions`). */
  actions: unknown;
  /**
   * The live approval request for this record, carrying the server-computed
   * `viewer` block. `null` when the record has no live request — nothing is
   * mirrored then.
   */
  request: Record<string, any> | null | undefined;
  /**
   * Ambient predicate scope (`user` / `app` / `features`) so a predicate that
   * reaches past the row still resolves.
   */
  scope?: Record<string, unknown>;
  i18n: DeclaredActionI18n;
}

/**
 * Build the record header's approval actions from `sys_approval_request`'s
 * declared metadata. Returns `[]` whenever there is nothing to show — no live
 * request, no declared actions, or every predicate gated the viewer out — so
 * the caller can splice the result in unconditionally.
 */
export function buildApprovalRecordHeaderActions(
  opts: ApprovalRecordHeaderActionOptions,
): ActionDef[] {
  const { actions, request, scope, i18n } = opts;
  if (!request || !Array.isArray(actions)) return [];

  const out: ActionDef[] = [];
  let order = APPROVAL_HEADER_ORDER_BASE;

  for (const action of actions as any[]) {
    if (!action || typeof action !== 'object') continue;
    const locations: unknown[] = Array.isArray(action.locations) ? action.locations : [];
    const inline = locations.includes(INLINE_LOCATION);
    if (!inline && !locations.includes(OVERFLOW_LOCATION)) continue;

    const name = typeof action.name === 'string' ? action.name : '(unnamed)';
    if (action.visible !== undefined && action.visible !== null && action.visible !== '') {
      if (!resolvePredicate(action.visible, request, scope, `${APPROVAL_REQUEST_OBJECT} "${name}" (visible)`)) {
        continue;
      }
    }
    if (action.hidden !== undefined && action.hidden !== null && action.hidden !== '') {
      if (resolvePredicate(action.hidden, request, scope, `${APPROVAL_REQUEST_OBJECT} "${name}" (hidden)`)) {
        continue;
      }
    }
    const disabled = action.disabled === undefined || action.disabled === null || action.disabled === ''
      ? undefined
      : resolvePredicate(action.disabled, request, scope, `${APPROVAL_REQUEST_OBJECT} "${name}" (disabled)`);

    // `visible` / `hidden` / `disabled` are already resolved above, and
    // `locations` is remapped below — drop all four so the header never re-runs
    // an approval predicate against the HOST record (no `viewer` → fail closed,
    // i.e. every mirrored action would vanish).
    const declared: Record<string, any> = { ...action };
    for (const key of RESOLVED_HERE) delete declared[key];
    const dispatch = buildDeclaredActionDispatch(declared as ActionDef, {
      objectName: APPROVAL_REQUEST_OBJECT,
      record: request,
      i18n,
    }) as Record<string, any>;

    out.push({
      ...dispatch,
      locations: [inline ? 'record_header' : 'record_more'],
      order: order++,
      // The spec's `danger` and the header Button's `destructive` are the same
      // variant spelled two ways; anything else passes through untouched.
      ...(dispatch.variant === 'danger' ? { variant: 'destructive' } : {}),
      ...(disabled !== undefined ? { disabled } : {}),
    } as ActionDef);
  }

  return out;
}
