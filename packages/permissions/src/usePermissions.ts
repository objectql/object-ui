/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useContext, useMemo } from 'react';
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

  // Memoize the returned object so consumers that include `usePermissions()`
  // in dependency arrays don't re-run on every render. Without this,
  // downstream `useMemo`/`useEffect` deps see a fresh object each render and
  // can enter infinite update loops (see DetailView gatedSchema → data
  // fetch effect, which would re-fire on every render otherwise).
  return useMemo(() => {
    if (!ctx) {
      return {
        check: (): PermissionCheckResult => ({ allowed: true }),
        checkField: () => true,
        getFieldPermissions: () => [],
        getRowFilter: () => undefined,
        roles: [],
        systemPermissions: [],
        hasCapabilities: () => true,
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
  }, [ctx]);
}
