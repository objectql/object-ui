/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Authentication types for @object-ui/auth
 */

/** Authenticated user information */
export interface AuthUser {
  /** Unique user identifier */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Profile image URL */
  image?: string;
  /** Primary role */
  role?: string;
  /** All assigned roles */
  roles?: string[];
  /** Email verification status */
  emailVerified?: boolean;
  /** Additional user metadata */
  [key: string]: unknown;
}

/**
 * Get user initials from their name or email.
 * Returns up to 2 uppercase characters.
 */
export function getUserInitials(user: Pick<AuthUser, 'name' | 'email'> | null | undefined): string {
  if (!user) return '?';
  if (user.name) {
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email?.[0]?.toUpperCase() ?? '?';
}

/** Session information */
export interface AuthSession {
  /** Access token */
  token: string;
  /** Token expiry timestamp */
  expiresAt?: Date;
  /** Refresh token */
  refreshToken?: string;
}

/** Authentication state */
export interface AuthState {
  /** Current authenticated user */
  user: AuthUser | null;
  /** Current session */
  session: AuthSession | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is loading */
  isLoading: boolean;
  /** Authentication error */
  error: Error | null;
}

/** Sign in credentials */
export interface SignInCredentials {
  email: string;
  password: string;
}

/** Sign up data */
export interface SignUpData {
  name: string;
  email: string;
  password: string;
}

/** Auth client configuration */
export interface AuthClientConfig {
  /** Authentication server URL (e.g., "/api/auth") */
  baseURL: string;
  /** Custom fetch function for requests */
  fetchFn?: typeof fetch;
}

/** Auth client interface - abstracts the underlying auth library */
export interface AuthClient {
  /** Sign in with email/password */
  signIn: (credentials: SignInCredentials) => Promise<{ user: AuthUser; session: AuthSession }>;
  /** Sign up with email/password */
  signUp: (data: SignUpData) => Promise<{ user: AuthUser; session: AuthSession }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Get current session */
  getSession: () => Promise<{ user: AuthUser; session: AuthSession } | null>;
  /** Reset password request */
  forgotPassword: (email: string) => Promise<void>;
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /** Update user profile */
  updateUser: (data: Partial<AuthUser>) => Promise<AuthUser>;
}

/** Auth provider configuration */
export interface AuthProviderConfig {
  /** Authentication server URL */
  authUrl: string;
  /** Auth client instance (if already created) */
  client?: AuthClient;
  /** Callback when auth state changes */
  onAuthStateChange?: (state: AuthState) => void;
  /** Path to redirect to when not authenticated */
  redirectTo?: string;
}
