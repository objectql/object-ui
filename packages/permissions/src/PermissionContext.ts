/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext } from 'react';
import type { PermissionAction, PermissionCheckResult, FieldLevelPermission } from '@object-ui/types';

export interface PermissionContextValue {
  /** Check if action is allowed on object */
  check: (object: string, action: PermissionAction, record?: Record<string, unknown>) => PermissionCheckResult;
  /** Check field-level permissions */
  checkField: (object: string, field: string, action: 'read' | 'write') => boolean;
  /** Get field permissions for an object */
  getFieldPermissions: (object: string) => FieldLevelPermission[];
  /** Get row filter for an object */
  getRowFilter: (object: string) => string | undefined;
  /**
   * [#3391] Server-resolved effective API operation set for an object (from
   * `/me/permissions` `apiOperations`), or `undefined` when the object carries
   * no effective set (unrestricted object / old backend / no provider). The UI
   * intersects this with its CRUD affordances (`resolveCrudAffordances`), never
   * reading the raw `apiMethods`. `undefined` → callers keep current behavior.
   */
  getObjectApiOperations: (object: string) => string[] | undefined;
  /** Current user roles */
  roles: string[];
  /**
   * [objectui#5683] The acting user's id, from `/me/permissions` (`userId`) —
   * or `null` when the mounted provider has no backend answer to give (the
   * role-based `PermissionProvider`, no provider at all, or an anonymous
   * session). `null` means "unknown", and consumers must fall back to
   * server-side behavior rather than substituting any other identity — the
   * create-form `current_user` default seeding leaves the field empty and the
   * key omitted, which is exactly the case the engine resolves at insert.
   */
  userId: string | null;
  /**
   * [ADR-0066] System capabilities held by the user (union of permission-set
   * `systemPermissions`), when the backend actually reports them.
   *
   * [objectui#4656] `undefined` means no answer was ever reported — a backend
   * predating ADR-0066 (the `/me/permissions` response omits the field
   * entirely), or no permission provider mounted at all — and is NOT the same
   * as a genuinely empty grant (`[]`, "reported, holds nothing"). A provider
   * that cannot tell the two apart must not collapse them into the same
   * value: doing so is exactly what silently stripped capability-gated UI
   * from every admin on a non-reporting deployment. Callers that need the raw
   * signal (rather than a specific capability check) read this directly;
   * `hasCapabilities` below already resolves the right verdict for either
   * case, so most callers never need to.
   */
  systemPermissions: string[] | undefined;
  /**
   * [ADR-0066] True when the user holds ALL of `required` capabilities.
   *
   * [objectui#4656] Fails OPEN (`true`) when `systemPermissions` is
   * `undefined` — an unreported answer is not a denial, the server still
   * enforces the capability regardless of what the UI shows, and hiding a
   * permitted user's UI on missing client data is the worse failure. This is
   * the same doctrine `useCapabilityGate` (`@object-ui/react`) already states
   * for the ADR-0066 D4 action gate (framework#3923), centralized here so
   * every `hasCapabilities` call site gets it for free instead of
   * re-deriving a "treat an empty set as unreported" heuristic locally. A
   * REPORTED empty array gates strictly: "holds nothing" is a real,
   * enforceable answer and must not be read as "unknown".
   */
  hasCapabilities: (required: string[]) => boolean;
  /** Whether permissions are loaded */
  isLoaded: boolean;
}

export const PermCtx = createContext<PermissionContextValue | null>(null);
PermCtx.displayName = 'PermissionContext';
