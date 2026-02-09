/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import type { TenantBranding } from '@object-ui/types';
import { useTenant } from './useTenant';

/**
 * Hook to access resolved tenant branding.
 * Returns default branding if no tenant is configured.
 */
export function useTenantBranding(): TenantBranding {
  const tenantCtx = useTenant();

  return useMemo<TenantBranding>(
    () =>
      tenantCtx?.branding ?? {
        companyName: 'ObjectUI',
        primaryColor: '#3b82f6',
        secondaryColor: '#64748b',
      },
    [tenantCtx?.branding],
  );
}
