/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext } from 'react';
import type { TenantContext } from '@object-ui/types';

export interface TenantContextValue extends TenantContext {
  /** Switch to a different tenant */
  switchTenant: (tenantId: string) => Promise<void>;
  /** Whether tenant is loading */
  isLoading: boolean;
  /** Error if tenant resolution failed */
  error: Error | null;
}

export const TenantCtx = createContext<TenantContextValue | null>(null);
TenantCtx.displayName = 'TenantContext';
