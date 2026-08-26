/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The predicate-evaluation identity `ExpressionProvider` binds as
 * `current_user` / `ctx.user` / `os.user`.
 *
 * Extracted from `AppContent`'s body in objectui#5424 so the SHAPE it
 * advertises is assertable on its own — the defect it carried was a key that
 * was always `undefined`, which no render-level assertion can see.
 *
 * ## Why it lives HERE and not in `AppContent` (objectui#6515)
 *
 * It sat in `console/AppContent.tsx`, and `AppContent` `lazy()`-loads the views
 * that also mount an `ExpressionProvider` — `views/RecordFormPage.tsx` is one.
 * A view importing the normaliser from its old home would create a STATIC edge
 * from the lazily-split chunk back into the console module it was split out of,
 * which is precisely what `scripts/check-eager-closure-budget.mjs` weighs. So
 * the site that most needed the shared normaliser was the one site that could
 * not afford to import it, and it hand-rolled the descriptor instead — missing
 * `id` and `isPlatformAdmin`, the two roots real predicates name
 * (`ctx.user.isPlatformAdmin == true` gates `sys_environment`'s "Change Plan
 * (admin)" action; `record.id == ctx.user.id` is the shape `sys_user`'s own
 * gates use). An absent key is not `false`: it makes the predicate FAULT, and a
 * faulting visibility predicate fails OPEN (`evaluateVisibility`), so the gate
 * silently did not bite.
 *
 * This module is a LEAF — it imports nothing — so every mount site can reach it
 * without dragging a chunk along, and it sits beside the `ExpressionProvider`
 * it feeds rather than beside one of its callers. `AppContent` and the package
 * index both re-export the name, so nothing published moved.
 *
 * ## Shape notes
 *
 * `roles` is deliberately ABSENT, not merely empty. It used to be forwarded as
 * `roles: (user as any).roles`, and the protocol-17 session face emits no
 * `roles` key at all (framework ADR-0090 D3 renamed it to `positions` with no
 * deprecation window — measured in objectui#5389), so the key reached every CEL
 * predicate as `undefined`: an author writing `'manager' in current_user.roles`
 * got a shape that answered, wrongly, rather than one that was plainly not
 * there. `positions` below is the published spelling and carries the same
 * names. Not paired as a fallback — that is what ADR-0090 D3 forbids
 * (`packages/auth/src/types.ts`).
 *
 * The signed-out branch never had `roles` either, so removing it also makes the
 * two branches agree on one shape. Both branches carry `isPlatformAdmin` and
 * `positions` for the same reason: a predicate naming either must evaluate to
 * FALSE, not fault.
 */
export function buildExpressionUser(user: unknown): Record<string, unknown> {
  const u = user as
    | { id?: string; name?: string; email?: string; role?: string; [key: string]: unknown }
    | null
    | undefined;
  if (!u) {
    return { name: 'Anonymous', email: '', role: 'guest', isPlatformAdmin: false, positions: [] };
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? 'user',
    // Surface the platform-admin flag so action `visible` CEL predicates
    // gated on `ctx.user.isPlatformAdmin == true` (e.g. sys_environment
    // "Change Plan (admin)") evaluate correctly. Previously only
    // name/email/role were forwarded → isPlatformAdmin-gated actions were
    // hidden even for platform admins.
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    // Positions are what the SERVER binds as `current_user` for per-option
    // `visibleWhen` authorization gating (ADR-0058; framework EvalUser —
    // objectui#2284). Forwarding them lets a position-gated option
    // (`'admin' in current_user.positions`) hide client-side too, instead
    // of failing open as visible and only being rejected on submit.
    positions: u.positions ?? [],
  };
}
