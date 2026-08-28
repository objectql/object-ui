/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useAuth } from './useAuth.js';

const ADMIN_ROLES = new Set([
  'owner',
  'admin',
  'super_admin',
  'superadmin',
  'platform_admin',
  'system_admin',
  // ADR-0068 canonical names, emitted into `user.positions[]` by the server's
  // customSession (raw better-auth owner/admin are normalized to org_owner/
  // org_admin). Accept both raw and canonical so admin detection survives the
  // removal of the `user.role = 'admin'` overwrite footgun.
  'org_owner',
  'org_admin',
]);

/**
 * One name from any of the three sources below — a membership role, the stored
 * `user.role` scalar, or an entry of `user.positions[]`. The three draw on one
 * vocabulary by design (ADR-0068 D2 maps a membership `owner`/`admin` onto the
 * canonical `org_owner`/`org_admin` that `positions[]` carries), so one
 * predicate serves all three.
 */
function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && ADMIN_ROLES.has(role.toLowerCase());
}

/**
 * The workspace-admin verdict AND whether it is worth acting on yet.
 *
 * These are two different facts and they were one boolean until objectui#5619.
 * See {@link useWorkspaceAdminStatus} for why collapsing them was a defect.
 */
export interface WorkspaceAdminStatus {
  /**
   * True only when adminship is CONFIRMED by one of the three legs below.
   * While `isResolved` is false this is `false` because nothing has said
   * otherwise yet — NOT because the viewer is known not to be an admin.
   */
  isAdmin: boolean;
  /**
   * Whether every input `isAdmin` depends on has arrived. Gate any branch
   * whose wrong side is expensive — a refusal screen, a `<Navigate>`, a nav
   * entry that would have to be added back — on this being true.
   */
  isResolved: boolean;
}

/**
 * Whether the current user has owner/admin privileges, and whether that answer
 * has finished resolving.
 *
 * Sources considered (any one is sufficient):
 *  - The active organization member row (multi-tenant mode).
 *  - The top-level `user.role` scalar from the session — legacy deployments
 *    that still store an admin role on the user row.
 *  - `user.positions[]` from the session — the canonical identity/position
 *    names the server derives (ADR-0068 D1/D2, renamed from `roles` by
 *    ADR-0090 D3). This is the ONLY leg that sees a platform administrator
 *    whose adminship comes from the `admin_full_access` permission set: on a
 *    single-tenant deployment there is no member row to read (leg 1), and the
 *    server deliberately no longer overwrites `user.role` (leg 2), so
 *    `positions` carrying `platform_admin` is the whole signal. Measured on a
 *    live protocol-17 server in objectui#5389; pinned by
 *    `__tests__/workspaceAdminPositions-5389.test.tsx`.
 *
 * `positions` is the ONE published spelling. It is deliberately not read
 * alongside the retired `roles` (ADR-0090 D3 renamed with no deprecation
 * window and bans resurrecting the old name as a fallback), and not alongside
 * the derived `user.isPlatformAdmin` either — that flag is computed by the
 * server as `'platform_admin' in positions` from the same expression, so
 * reading both would be two spellings for one fact with no way to disagree
 * usefully and every way to drift.
 *
 * In preview-mode / no-auth-enabled mode the provider seeds an admin user,
 * so this returns `isAdmin: true` for dev/demo setups.
 *
 * ## Why this returns a pair and not a boolean (objectui#5619)
 *
 * It used to return a bare `boolean`, which gave "not resolved yet" and
 * "resolved: not an admin" the same answer — `false`. Leg 1 is not settled
 * when a console page first mounts: `AuthProvider.refreshActiveMember` runs
 * from its own effect, keyed on `activeOrganization`, which itself appears
 * only after `listOrganizations()` → `getActiveOrganization()` (→ the ADR-0081
 * single-membership `setActiveOrganization()` repair) resolve. So an
 * administrator whose adminship lives ONLY in the member row rendered at least
 * once as a non-admin, and every gate downstream acted on it: two marketplace
 * surfaces painted `MarketplaceAccessDenied` at a real administrator, the
 * console chrome dropped and re-added a nav entry, and `AppContent` fired a
 * `<Navigate to="/home" replace>` that the later flip cannot undo.
 *
 * Legs 2 and 3 DO cover that viewer whenever the session was minted with an
 * active organization stamped on it — framework `auth-manager.ts` reads
 * `session.activeOrganizationId` and, when it is set, maps the member row into
 * `positions[]` as `org_owner`/`org_admin`. The window is therefore not "every
 * tenant admin" as first reported, but "every session that reaches the console
 * without that stamp", which is exactly the path `refreshOrganizations`'
 * ADR-0081 repair exists to serve.
 *
 * `isResolved` is deliberately true the moment `isAdmin` is true: a confirmed
 * admin is a final answer, and the legs still in flight can only agree with it.
 * Callers therefore never wait on a verdict they already have — an admin
 * detected through `positions` pays nothing for this gate.
 */
export function useWorkspaceAdminStatus(): WorkspaceAdminStatus {
  const { activeMember, user, isLoading, isMembershipResolved } = useAuth();

  const positions = user?.positions;
  const isAdmin =
    isAdminRole(activeMember?.role) ||
    isAdminRole(user?.role) ||
    (Array.isArray(positions) && positions.some(isAdminRole));

  if (isAdmin) return { isAdmin: true, isResolved: true };

  // Legs 2 and 3 are settled once the session has landed (`isLoading`); leg 1
  // is settled once the organization/member pipeline has reached a terminal
  // state (`isMembershipResolved`). Both, because a viewer can be an admin
  // through either.
  return { isAdmin: false, isResolved: !isLoading && isMembershipResolved };
}
