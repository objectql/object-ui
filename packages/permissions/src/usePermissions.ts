/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useContext } from 'react';
import type { PermissionAction, PermissionCheckResult } from '@object-ui/types';
import { PermCtx, type PermissionContextValue } from './PermissionContext';

/**
 * Hook to access the permission system.
 * Must be used within a PermissionProvider.
 */
export function usePermissions(): PermissionContextValue & {
  /** Convenience: check if action is allowed */
  can: (object: string, action: PermissionAction) => boolean;
  /** Convenience: check if action is denied */
  cannot: (object: string, action: PermissionAction) => boolean;
} {
  const ctx = useContext(PermCtx);

  if (!ctx) {
    // Return a permissive default when no provider exists
    return {
      check: (): PermissionCheckResult => ({ allowed: true }),
      checkField: () => true,
      getFieldPermissions: () => [],
      getRowFilter: () => undefined,
      roles: [],
      isLoaded: false,
      can: () => true,
      cannot: () => false,
    };
  }

  return {
    ...ctx,
    can: (object: string, action: PermissionAction) => ctx.check(object, action).allowed,
    cannot: (object: string, action: PermissionAction) => !ctx.check(object, action).allowed,
  };
}
