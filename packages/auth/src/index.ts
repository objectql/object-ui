/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/auth
 *
 * Authentication system for Object UI providing:
 * - AuthProvider context for React apps
 * - useAuth hook for accessing auth state and methods
 * - AuthGuard component for route protection
 * - LoginForm, RegisterForm, ForgotPasswordForm UI components
 * - UserMenu component for authenticated user display
 * - createAuthClient factory for auth backend integration
 * - createAuthenticatedFetch for DataSource token injection
 *
 * @packageDocumentation
 */

export { AuthProvider, type AuthProviderProps } from './AuthProvider';
export { useAuth } from './useAuth';
export { AuthGuard, type AuthGuardProps } from './AuthGuard';
export { LoginForm, type LoginFormProps } from './LoginForm';
export { RegisterForm, type RegisterFormProps } from './RegisterForm';
export { ForgotPasswordForm, type ForgotPasswordFormProps } from './ForgotPasswordForm';
export { UserMenu, type UserMenuProps } from './UserMenu';
export { PreviewBanner, type PreviewBannerProps } from './PreviewBanner';
export { createAuthClient } from './createAuthClient';
export { createAuthenticatedFetch, type AuthenticatedAdapterOptions } from './createAuthenticatedFetch';
export { getUserInitials } from './types';

// Re-export types for convenience
export type {
  AuthUser,
  AuthSession,
  AuthState,
  AuthClient,
  AuthClientConfig,
  AuthProviderConfig,
  PreviewModeOptions,
  SignInCredentials,
  SignUpData,
} from './types';

export type { AuthContextValue } from './AuthContext';
