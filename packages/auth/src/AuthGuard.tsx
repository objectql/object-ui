/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useAuth } from './useAuth';

export interface AuthGuardProps {
  /** Content to render when user is not authenticated */
  fallback?: React.ReactNode;
  /** Required roles (user must have at least one) */
  requiredRoles?: string[];
  /** Required permissions (user must have all) */
  requiredPermissions?: string[];
  /** Content to render when loading */
  loadingFallback?: React.ReactNode;
  /** Children to render when authenticated */
  children: React.ReactNode;
}

/**
 * Route guard component that conditionally renders children
 * based on authentication and authorization state.
 *
 * @example
 * ```tsx
 * <AuthGuard fallback={<Navigate to="/login" />}>
 *   <ProtectedPage />
 * </AuthGuard>
 *
 * <AuthGuard requiredRoles={['admin']} fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  fallback = null,
  requiredRoles,
  loadingFallback,
  children,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <>{loadingFallback ?? null}</>;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0 && user) {
    const userRoles = user.roles ?? (user.role ? [user.role] : []);
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
