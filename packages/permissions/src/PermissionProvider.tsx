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

      for (const role of userRoles) {
        const roleConfig = objectConfig.roles[role];
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
        const roleConfig = objectConfig.roles[role];
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
        const roleConfig = objectConfig.roles[role];
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
      roles: userRoles,
      isLoaded: true,
    }),
    [check, checkField, getFieldPermissions, getRowFilter, userRoles],
  );

  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}
