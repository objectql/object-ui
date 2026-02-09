/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Permission & RBAC Types
 * 
 * Complete RBAC (Role-Based Access Control) type definitions for
 * object/field/row-level permissions aligned with @objectstack/spec v2.0.1.
 * 
 * @module permissions
 * @packageDocumentation
 */

// ============================================================================
// Role-Based Access Control (RBAC)
// ============================================================================

/** Standard CRUD permission actions */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'export' | 'import' | 'share' | 'admin';

/** Permission effect */
export type PermissionEffect = 'allow' | 'deny';

/** Role definition for RBAC */
export interface RoleDefinition {
  /** Unique role identifier */
  name: string;
  /** Display label */
  label: string;
  /** Role description */
  description?: string;
  /** Parent role for inheritance */
  inherits?: string[];
  /** Whether this is a system role */
  system?: boolean;
  /** Object-level permissions */
  permissions: ObjectLevelPermission[];
}

/** Object-level permission assignment */
export interface ObjectLevelPermission {
  /** Target object name */
  object: string;
  /** Allowed actions */
  actions: PermissionAction[];
  /** Permission effect */
  effect?: PermissionEffect;
  /** Conditions for conditional permissions */
  conditions?: PermissionCondition[];
}

/** Field-level permission */
export interface FieldLevelPermission {
  /** Target field name */
  field: string;
  /** Read permission */
  read?: boolean;
  /** Write permission */
  write?: boolean;
  /** Permission effect */
  effect?: PermissionEffect;
  /** Mask value for restricted fields (e.g., '****' for SSN) */
  mask?: string;
}

/** Row-level permission (record-level security) */
export interface RowLevelPermission {
  /** Filter expression to scope visible records */
  filter: string;
  /** Actions allowed on matching records */
  actions: PermissionAction[];
  /** Description of the rule */
  description?: string;
}

/** Permission condition for conditional access */
export interface PermissionCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'is_null' | 'is_not_null';
  /** Value to compare */
  value: unknown;
}

/** Complete permission configuration for an object */
export interface ObjectPermissionConfig {
  /** Object name */
  object: string;
  /** Default permissions for unauthenticated users */
  publicAccess?: PermissionAction[];
  /** Role-based permissions */
  roles: Record<string, {
    actions: PermissionAction[];
    fieldPermissions?: FieldLevelPermission[];
    rowPermissions?: RowLevelPermission[];
  }>;
  /** Field-level permission defaults */
  fieldDefaults?: FieldLevelPermission[];
  /** Sharing rules */
  sharingRules?: SharingRuleConfig[];
}

/** Sharing rule configuration */
export interface SharingRuleConfig {
  /** Rule name */
  name: string;
  /** Share with type */
  type: 'role' | 'user' | 'group' | 'public';
  /** Target entity (role name, user ID, group name) */
  entity: string;
  /** Permitted actions */
  actions: PermissionAction[];
  /** Filter to scope which records are shared */
  filter?: string;
}

/** Permission check result */
export interface PermissionCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason for denial */
  reason?: string;
  /** Applicable field restrictions */
  fieldRestrictions?: FieldLevelPermission[];
  /** Row filter to apply */
  rowFilter?: string;
}

/** Permission context for evaluating permissions */
export interface PermissionContext {
  /** Current user */
  user: {
    id: string;
    roles: string[];
    groups?: string[];
    [key: string]: unknown;
  };
  /** Target object */
  object: string;
  /** Target action */
  action: PermissionAction;
  /** Target record (for row-level checks) */
  record?: Record<string, unknown>;
  /** Target field (for field-level checks) */
  field?: string;
}

/** Permission guard configuration for UI components */
export interface PermissionGuardConfig {
  /** Required permission */
  permission: string | PermissionAction;
  /** Target object */
  object?: string;
  /** Fallback behavior when denied */
  fallback?: 'hide' | 'disable' | 'redirect' | 'custom';
  /** Custom fallback component type */
  fallbackComponent?: string;
  /** Redirect path for 'redirect' fallback */
  redirectPath?: string;
}
