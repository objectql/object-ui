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
  /** Current user roles */
  roles: string[];
  /** [ADR-0066] System capabilities held by the user (union of permission-set systemPermissions). */
  systemPermissions: string[];
  /** [ADR-0066] True when the user holds ALL of `required` capabilities (subset check). */
  hasCapabilities: (required: string[]) => boolean;
  /** Whether permissions are loaded */
  isLoaded: boolean;
}

export const PermCtx = createContext<PermissionContextValue | null>(null);
PermCtx.displayName = 'PermissionContext';
