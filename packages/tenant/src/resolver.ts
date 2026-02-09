/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TenantResolutionStrategy } from '@object-ui/types';

export interface TenantResolver {
  /** Resolve tenant ID from the current context */
  resolve: () => string | null;
}

/**
 * Creates a tenant resolver based on the specified strategy.
 *
 * @param strategy - How to extract the tenant identifier
 * @param options - Strategy-specific options
 * @returns A TenantResolver instance
 */
export function createTenantResolver(
  strategy: TenantResolutionStrategy,
  options?: {
    headerName?: string;
    queryParam?: string;
    cookieName?: string;
    customResolver?: () => string | null;
  },
): TenantResolver {
  switch (strategy) {
    case 'subdomain':
      return {
        resolve: () => {
          if (typeof window === 'undefined') return null;
          const parts = window.location.hostname.split('.');
          return parts.length > 2 ? parts[0] : null;
        },
      };

    case 'path':
      return {
        resolve: () => {
          if (typeof window === 'undefined') return null;
          const parts = window.location.pathname.split('/').filter(Boolean);
          return parts.length > 0 ? parts[0] : null;
        },
      };

    case 'header':
      return {
        resolve: () => null, // Headers are server-side only
      };

    case 'query':
      return {
        resolve: () => {
          if (typeof window === 'undefined') return null;
          const params = new URLSearchParams(window.location.search);
          return params.get(options?.queryParam ?? 'tenant');
        },
      };

    case 'cookie':
      return {
        resolve: () => {
          if (typeof document === 'undefined') return null;
          const name = options?.cookieName ?? 'tenant_id';
          const cookies = document.cookie.split('; ');
          for (const cookie of cookies) {
            const eqIndex = cookie.indexOf('=');
            if (eqIndex === -1) continue;
            const key = cookie.substring(0, eqIndex);
            if (key === name) {
              return decodeURIComponent(cookie.substring(eqIndex + 1));
            }
          }
          return null;
        },
      };

    case 'custom':
      return {
        resolve: () => options?.customResolver?.() ?? null,
      };

    default:
      return {
        resolve: () => null,
      };
  }
}
