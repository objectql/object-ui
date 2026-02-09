/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useContext } from 'react';
import { TenantCtx, type TenantContextValue } from './TenantContext';

/**
 * Hook to access the current tenant context.
 * Must be used within a TenantProvider.
 *
 * @returns Tenant context value or null if no tenant is configured
 */
export function useTenant(): TenantContextValue | null {
  return useContext(TenantCtx);
}
