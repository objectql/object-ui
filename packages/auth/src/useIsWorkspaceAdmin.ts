/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useAuth } from './useAuth';

const ADMIN_ROLES = new Set([
  'owner',
  'admin',
  'super_admin',
  'superadmin',
  'platform_admin',
  'system_admin',
  // ADR-0068 canonical role names emitted into `user.roles[]` by the server
  // customSession (raw better-auth owner/admin are normalized to org_owner/
  // org_admin). Accept both raw and canonical so admin detection survives the
  // removal of the `user.role = 'admin'` overwrite footgun.
  'org_owner',
  'org_admin',
]);

function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && ADMIN_ROLES.has(role.toLowerCase());
}

/**
 * Returns true when the current user has owner/admin privileges.
 *
 * Sources considered (any one is sufficient):
 *  - The active organization member row (multi-tenant mode).
 *  - The top-level `user.role` / `user.roles` from the session — this covers
 *    platform / system administrators in single-tenant deployments where
 *    there is no `activeMember` row to read a role from.
 *
 * In preview-mode / no-auth-enabled mode the provider seeds an admin user,
 * so this returns `true` for dev/demo setups.
 */
export function useIsWorkspaceAdmin(): boolean {
  const { activeMember, user } = useAuth();
  if (isAdminRole(activeMember?.role)) return true;
  if (isAdminRole(user?.role)) return true;
  if (Array.isArray(user?.roles) && user!.roles!.some(isAdminRole)) return true;
  return false;
}
