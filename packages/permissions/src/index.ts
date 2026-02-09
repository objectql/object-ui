/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/permissions
 * 
 * RBAC permission system for Object UI providing:
 * - PermissionProvider context for React apps
 * - usePermissions hook for checking access
 * - PermissionGuard component for conditional rendering
 * - Permission evaluation engine
 * - Field-level and row-level permission support
 * 
 * @packageDocumentation
 */

export { PermissionProvider, type PermissionProviderProps } from './PermissionProvider';
export { usePermissions } from './usePermissions';
export { useFieldPermissions } from './useFieldPermissions';
export { PermissionGuard, type PermissionGuardProps } from './PermissionGuard';
export { evaluatePermission } from './evaluator';
export { createPermissionStore, type PermissionStore } from './store';

// Re-export types for convenience
export type {
  PermissionAction,
  PermissionEffect,
  RoleDefinition,
  ObjectLevelPermission,
  FieldLevelPermission,
  RowLevelPermission,
  PermissionCondition,
  ObjectPermissionConfig,
  SharingRuleConfig,
  PermissionCheckResult,
  PermissionContext,
  PermissionGuardConfig,
} from '@object-ui/types';
