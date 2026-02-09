/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/tenant
 *
 * Multi-tenancy support for Object UI providing:
 * - TenantProvider context for React apps
 * - useTenant hook for accessing tenant context
 * - Tenant isolation and scoped queries
 * - Custom branding per tenant
 *
 * @packageDocumentation
 */

export { TenantProvider, type TenantProviderProps } from './TenantProvider';
export { useTenant } from './useTenant';
export { useTenantBranding } from './useTenantBranding';
export { TenantGuard, type TenantGuardProps } from './TenantGuard';
export { createTenantResolver, type TenantResolver } from './resolver';
export { TenantScopedQuery, type TenantScopedQueryProps } from './TenantScopedQuery';

// Re-export types for convenience
export type {
  TenantConfig,
  TenantBranding,
  TenantLimits,
  TenantContext,
  TenantProviderConfig,
  TenantScopedQueryConfig,
  TenantIsolationStrategy,
  TenantStatus,
  TenantPlan,
  TenantResolutionStrategy,
} from '@object-ui/types';
