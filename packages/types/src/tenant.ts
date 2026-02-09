/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Multi-Tenancy Types
 * 
 * Type definitions for multi-tenant architecture support including
 * tenant isolation, scoped queries, and custom branding.
 * 
 * @module tenant
 * @packageDocumentation
 */

import type { Theme } from './theme';

// ============================================================================
// Tenant Configuration
// ============================================================================

/** Tenant isolation strategy */
export type TenantIsolationStrategy = 'database' | 'schema' | 'row' | 'hybrid';

/** Tenant status */
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'archived';

/** Tenant plan/tier */
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';

/** Tenant definition */
export interface TenantConfig {
  /** Unique tenant identifier */
  id: string;
  /** Tenant display name */
  name: string;
  /** Tenant slug (URL-friendly identifier) */
  slug: string;
  /** Tenant status */
  status: TenantStatus;
  /** Subscription plan */
  plan?: TenantPlan;
  /** Tenant domain (for custom domain support) */
  domain?: string;
  /** Data isolation strategy */
  isolation: TenantIsolationStrategy;
  /** Custom branding */
  branding?: TenantBranding;
  /** Feature flags */
  features?: Record<string, boolean>;
  /** Usage limits */
  limits?: TenantLimits;
  /** Tenant metadata */
  metadata?: Record<string, unknown>;
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
}

/** Tenant branding configuration */
export interface TenantBranding {
  /** Company logo URL */
  logo?: string;
  /** Favicon URL */
  favicon?: string;
  /** Primary brand color */
  primaryColor?: string;
  /** Secondary brand color */
  secondaryColor?: string;
  /** Custom theme override */
  theme?: Partial<Theme>;
  /** Custom CSS */
  customCSS?: string;
  /** Company name displayed in UI */
  companyName?: string;
  /** Support email */
  supportEmail?: string;
  /** Custom login page background */
  loginBackground?: string;
  /** Email templates branding */
  emailBranding?: {
    headerLogo?: string;
    footerText?: string;
    primaryColor?: string;
  };
}

/** Tenant usage limits */
export interface TenantLimits {
  /** Maximum number of users */
  maxUsers?: number;
  /** Maximum storage in bytes */
  maxStorage?: number;
  /** Maximum API calls per day */
  maxAPICallsPerDay?: number;
  /** Maximum objects/tables */
  maxObjects?: number;
  /** Maximum records per object */
  maxRecordsPerObject?: number;
  /** Maximum file upload size in bytes */
  maxFileSize?: number;
}

/** Tenant context for runtime use */
export interface TenantContext {
  /** Current tenant configuration */
  tenant: TenantConfig;
  /** Whether the user is a tenant admin */
  isTenantAdmin: boolean;
  /** Resolved branding (merged with defaults) */
  branding: TenantBranding;
  /** Active feature flags */
  features: Record<string, boolean>;
}

/** Tenant resolution strategy */
export type TenantResolutionStrategy = 'subdomain' | 'path' | 'header' | 'query' | 'cookie' | 'custom';

/** Tenant provider configuration */
export interface TenantProviderConfig {
  /** How to resolve tenant from request */
  resolution: TenantResolutionStrategy;
  /** Custom resolution function name */
  customResolver?: string;
  /** Header name for 'header' strategy */
  headerName?: string;
  /** Query parameter name for 'query' strategy */
  queryParam?: string;
  /** Cookie name for 'cookie' strategy */
  cookieName?: string;
  /** Default tenant ID for fallback */
  defaultTenantId?: string;
  /** Enable tenant caching */
  caching?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
}

/** Scoped query configuration for tenant isolation */
export interface TenantScopedQueryConfig {
  /** Tenant ID field name in records */
  tenantField: string;
  /** Whether to auto-inject tenant filter */
  autoFilter: boolean;
  /** Objects excluded from tenant scoping */
  excludedObjects?: string[];
  /** Whether to enforce tenant scope on writes */
  enforceOnWrite: boolean;
}
