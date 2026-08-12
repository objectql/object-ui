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

/**
 * Standard permission actions — re-exported from `@objectstack/spec/kernel`
 * rather than restated (objectstack#4115).
 *
 * The hand-written union this replaces carried 8 of the spec's 11 members: it
 * was missing `execute` (running a flow or action), `manage` and `configure`,
 * so a spec-valid grant of any of the three was a type error here.
 */
import type { PermissionAction } from '@objectstack/spec/kernel';
export type { PermissionAction };

/** Permission effect */
export type PermissionEffect = 'allow' | 'deny';

/**
 * Role definition for RBAC — identity and inheritance only.
 *
 * A role's actual grants live in {@link ObjectPermissionConfig.roles}, keyed by
 * object; that is the single wired home for "what a role may do". This type
 * used to declare a second one (`permissions: ObjectLevelPermission[]`,
 * required) that no consumer ever read — the evaluator family walks `inherits`
 * and matches on `name` — so it was retired rather than left as an authoring
 * surface whose values are silently ignored (objectui#4288). The element type
 * of that retired field, `ObjectLevelPermission`, lost its last structural
 * referent with it and has now been retired too (objectui#4364).
 */
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

/**
 * Permission condition for conditional access.
 *
 * Retained by measurement, not by default. objectui#4364 proposed retiring this
 * type alongside `ObjectLevelPermission`, on the premise that its only referent
 * was that type's `conditions` field. The premise did not hold: `evaluateCondition`
 * in `@object-ui/permissions` takes this shape as its parameter type and
 * implements all eleven operators declared below, under a 26-case suite that
 * covers each operator and the prototype-pollution guard. So this still types a
 * real reader and is not dead surface — only `ObjectLevelPermission` was.
 */
export interface PermissionCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'is_null' | 'is_not_null';
  /** Value to compare */
  value: unknown;
}

/**
 * Complete permission configuration for an object — the single wired home for
 * object-scoped grants, and the shape the evaluator actually reads.
 *
 * `roles` declares its inner grant shape inline. A second, parallel declaration
 * of the same idea (`ObjectLevelPermission`, an `{ object, actions, effect?,
 * conditions? }` record) was exported from this module until objectui#4364.
 * Once `RoleDefinition.permissions` was retired (objectui#4288) nothing
 * constructed, accepted or read one, so it was removed rather than left named
 * in the public surface — where a type the runtime does not honour reads as an
 * alternative way to express grants. If role-direct grants gain a business
 * need, they come back together with their reader.
 */
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
