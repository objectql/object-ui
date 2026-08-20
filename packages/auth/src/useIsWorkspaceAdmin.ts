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
 * Returns true when the current user has owner/admin privileges.
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
 * so this returns `true` for dev/demo setups.
 */
export function useIsWorkspaceAdmin(): boolean {
  const { activeMember, user } = useAuth();
  if (isAdminRole(activeMember?.role)) return true;
  if (isAdminRole(user?.role)) return true;
  const positions = user?.positions;
  if (Array.isArray(positions) && positions.some(isAdminRole)) return true;
  return false;
}
