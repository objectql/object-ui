/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useTenant } from './useTenant';

export interface TenantGuardProps {
  /** Required feature flag */
  feature?: string;
  /** Required tenant plan(s) */
  plan?: string | string[];
  /** Required tenant status */
  status?: string;
  /** Fallback content when guard fails */
  fallback?: React.ReactNode;
  /** Children to render when guard passes */
  children: React.ReactNode;
}

/**
 * Guard component that conditionally renders children based on tenant configuration.
 * Useful for feature gating and plan-based access control.
 */
export function TenantGuard({
  feature,
  plan,
  status,
  fallback = null,
  children,
}: TenantGuardProps) {
  const tenantCtx = useTenant();

  if (!tenantCtx) {
    return <>{fallback}</>;
  }

  // Check feature flag
  if (feature && !tenantCtx.features[feature]) {
    return <>{fallback}</>;
  }

  // Check plan
  if (plan) {
    const allowedPlans = Array.isArray(plan) ? plan : [plan];
    if (tenantCtx.tenant.plan && !allowedPlans.includes(tenantCtx.tenant.plan)) {
      return <>{fallback}</>;
    }
  }

  // Check status
  if (status && tenantCtx.tenant.status !== status) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
