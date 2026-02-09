/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  RoleDefinition,
  ObjectPermissionConfig,
  PermissionAction,
  PermissionCheckResult,
  PermissionCondition,
} from '@object-ui/types';

interface EvaluatePermissionParams {
  roles: RoleDefinition[];
  permissions: ObjectPermissionConfig[];
  userRoles: string[];
  user: { id: string; roles: string[]; [key: string]: unknown };
  object: string;
  action: PermissionAction;
  record?: Record<string, unknown>;
  field?: string;
}

/**
 * Evaluates whether an action is permitted based on RBAC configuration.
 * Supports role inheritance, field-level, and row-level permissions.
 */
export function evaluatePermission({
  roles,
  permissions,
  userRoles,
  object,
  action,
  record,
}: EvaluatePermissionParams): PermissionCheckResult {
  const objectConfig = permissions.find((p) => p.object === object);

  // If no config exists for the object, allow by default
  if (!objectConfig) {
    return { allowed: true };
  }

  // Check public access
  if (objectConfig.publicAccess?.includes(action)) {
    return { allowed: true };
  }

  // Resolve all effective roles (including inherited)
  const effectiveRoles = resolveRoles(userRoles, roles);

  // Check role-based permissions
  for (const roleName of effectiveRoles) {
    const roleConfig = objectConfig.roles[roleName];
    if (!roleConfig) continue;

    if (roleConfig.actions.includes(action)) {
      // Check row-level permissions if record is provided
      if (record && roleConfig.rowPermissions?.length) {
        const rowAllowed = roleConfig.rowPermissions.some(
          (rp) => rp.actions.includes(action),
        );
        if (!rowAllowed) continue;
      }

      return {
        allowed: true,
        fieldRestrictions: roleConfig.fieldPermissions,
        rowFilter: roleConfig.rowPermissions?.[0]?.filter,
      };
    }
  }

  return {
    allowed: false,
    reason: `Action '${action}' on '${object}' is not permitted for roles: ${userRoles.join(', ')}`,
  };
}

/**
 * Resolves all effective roles including inherited roles.
 */
function resolveRoles(userRoles: string[], roleDefinitions: RoleDefinition[]): string[] {
  const resolved = new Set<string>(userRoles);
  const queue = [...userRoles];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const roleDef = roleDefinitions.find((r) => r.name === current);
    if (roleDef?.inherits) {
      for (const parent of roleDef.inherits) {
        if (!resolved.has(parent)) {
          resolved.add(parent);
          queue.push(parent);
        }
      }
    }
  }

  return Array.from(resolved);
}

/**
 * Evaluates a permission condition against a record.
 */
export function evaluateCondition(
  condition: PermissionCondition,
  record: Record<string, unknown>,
): boolean {
  // Prevent prototype pollution via dangerous property access
  if (['__proto__', 'constructor', 'prototype'].includes(condition.field)) {
    return false;
  }

  const value = Object.prototype.hasOwnProperty.call(record, condition.field) ? record[condition.field] : undefined;

  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'gt':
      return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
    case 'gte':
      return typeof value === 'number' && typeof condition.value === 'number' && value >= condition.value;
    case 'lt':
      return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
    case 'lte':
      return typeof value === 'number' && typeof condition.value === 'number' && value <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'contains':
      return typeof value === 'string' && typeof condition.value === 'string' && value.includes(condition.value);
    case 'is_null':
      return value === null || value === undefined;
    case 'is_not_null':
      return value !== null && value !== undefined;
    default:
      return false;
  }
}
