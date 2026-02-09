/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { TenantConfig, TenantBranding, TenantProviderConfig } from '@object-ui/types';
import { TenantCtx, type TenantContextValue } from './TenantContext';

export interface TenantProviderProps {
  /** Tenant configuration or function to resolve tenant */
  tenant?: TenantConfig;
  /** Tenant provider configuration */
  config?: TenantProviderConfig;
  /** Callback to fetch tenant by ID */
  fetchTenant?: (tenantId: string) => Promise<TenantConfig>;
  /** Default branding to merge with tenant branding */
  defaultBranding?: Partial<TenantBranding>;
  /** Children */
  children: React.ReactNode;
}

const DEFAULT_BRANDING: TenantBranding = {
  companyName: 'ObjectUI',
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
};

export function TenantProvider({
  tenant: initialTenant,
  config,
  fetchTenant,
  defaultBranding,
  children,
}: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantConfig | null>(initialTenant ?? null);
  const [isLoading, setIsLoading] = useState(!initialTenant);
  const [error, setError] = useState<Error | null>(null);

  // Resolve tenant on mount
  useEffect(() => {
    if (initialTenant) {
      setTenant(initialTenant);
      setIsLoading(false);
      return;
    }

    if (config?.defaultTenantId && fetchTenant) {
      setIsLoading(true);
      fetchTenant(config.defaultTenantId)
        .then((resolved) => {
          setTenant(resolved);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [initialTenant, config?.defaultTenantId, fetchTenant]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (!fetchTenant) {
        throw new Error('fetchTenant is required to switch tenants');
      }
      setIsLoading(true);
      try {
        const resolved = await fetchTenant(tenantId);
        setTenant(resolved);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTenant],
  );

  const mergedBranding = useMemo<TenantBranding>(
    () => ({
      ...DEFAULT_BRANDING,
      ...defaultBranding,
      ...tenant?.branding,
    }),
    [defaultBranding, tenant?.branding],
  );

  const value = useMemo<TenantContextValue | null>(() => {
    if (!tenant) return null;

    return {
      tenant,
      isTenantAdmin: false,
      branding: mergedBranding,
      features: tenant.features ?? {},
      switchTenant,
      isLoading,
      error,
    };
  }, [tenant, mergedBranding, switchTenant, isLoading, error]);

  // While loading or if no tenant, still render children (they can handle null context)
  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}
