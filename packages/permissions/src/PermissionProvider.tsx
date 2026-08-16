/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo, useCallback } from 'react';
import type {
  RoleDefinition,
  ObjectPermissionConfig,
  PermissionAction,
  PermissionCheckResult,
  FieldLevelPermission,
} from '@object-ui/types';
import { PermCtx, type PermissionContextValue } from './PermissionContext';
import { evaluatePermission } from './evaluator';

export interface PermissionProviderProps {
  /** Role definitions */
  roles: RoleDefinition[];
  /** Object permission configurations */
  permissions: ObjectPermissionConfig[];
  /** Current user's role names */
  userRoles: string[];
  /** Current user context */
  user?: { id: string; [key: string]: unknown };
  /** Children */
  children: React.ReactNode;
}

export function PermissionProvider({
  roles,
  permissions,
  userRoles,
  user,
  children,
}: PermissionProviderProps) {
  const check = useCallback(
    (object: string, action: PermissionAction, record?: Record<string, unknown>): PermissionCheckResult => {
      return evaluatePermission({
        roles,
        permissions,
        userRoles,
        user: user ? { ...user, roles: userRoles } : { id: '', roles: userRoles },
        object,
        action,
        record,
      });
    },
    [roles, permissions, userRoles, user],
  );

  const checkField = useCallback(
    (object: string, field: string, action: 'read' | 'write'): boolean => {
      const objectConfig = permissions.find((p) => p.object === object);
      if (!objectConfig) return true; // No config means no restrictions

      // Same guard as `evaluator.ts` (objectui#4812): a config that omits the
      // required `roles` must deny or fall through, never throw. Here the
      // fall-through lands on this function's own documented default (allow),
      // which is unchanged — the guard removes the crash, not the semantics.
      for (const role of userRoles) {
        const roleConfig = objectConfig.roles?.[role];
        if (roleConfig?.fieldPermissions) {
          const fieldPerm = roleConfig.fieldPermissions.find((fp) => fp.field === field);
          if (fieldPerm) {
            return action === 'read' ? fieldPerm.read !== false : fieldPerm.write !== false;
          }
        }
      }

      // Check defaults
      if (objectConfig.fieldDefaults) {
        const defaultPerm = objectConfig.fieldDefaults.find((fp) => fp.field === field);
        if (defaultPerm) {
          return action === 'read' ? defaultPerm.read !== false : defaultPerm.write !== false;
        }
      }

      return true; // Default allow
    },
    [permissions, userRoles],
  );

  const getFieldPermissions = useCallback(
    (object: string): FieldLevelPermission[] => {
      const objectConfig = permissions.find((p) => p.object === object);
      if (!objectConfig) return [];

      const fieldPerms: FieldLevelPermission[] = [];
      for (const role of userRoles) {
        // Missing `roles` reports no restrictions rather than throwing
        // (objectui#4812).
        const roleConfig = objectConfig.roles?.[role];
        if (roleConfig?.fieldPermissions) {
          fieldPerms.push(...roleConfig.fieldPermissions);
        }
      }
      return fieldPerms;
    },
    [permissions, userRoles],
  );

  const getRowFilter = useCallback(
    (object: string): string | undefined => {
      const objectConfig = permissions.find((p) => p.object === object);
      if (!objectConfig) return undefined;

      for (const role of userRoles) {
        // Missing `roles` reports no row filter rather than throwing
        // (objectui#4812).
        const roleConfig = objectConfig.roles?.[role];
        if (roleConfig?.rowPermissions?.length) {
          return roleConfig.rowPermissions[0].filter;
        }
      }
      return undefined;
    },
    [permissions, userRoles],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      check,
      checkField,
      getFieldPermissions,
      getRowFilter,
      // [#3391] Role-based provider does not model the server's effective API
      // operation set — return undefined so consumers keep current behavior.
      getObjectApiOperations: () => undefined,
      roles: userRoles,
      // This role-based provider has no backend answer to give — it never
      // fetches /me/permissions — so ADR-0066 system capabilities are simply
      // unreported here: `undefined`, not `[]` (objectui#4656; a literal `[]`
      // would claim "reported, holds nothing", which this provider cannot
      // back up). `hasCapabilities` stays fail-open to match. The console
      // uses MePermissionsProvider, which wires the real systemPermissions
      // from /me/permissions.
      systemPermissions: undefined,
      hasCapabilities: () => true,
      isLoaded: true,
    }),
    [check, checkField, getFieldPermissions, getRowFilter, userRoles],
  );

  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}
