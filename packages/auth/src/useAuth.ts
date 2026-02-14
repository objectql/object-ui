/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useContext } from 'react';
import { AuthCtx, type AuthContextValue } from './AuthContext';

/**
 * Hook to access authentication state and methods.
 * Must be used within an AuthProvider.
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { user, isAuthenticated, signOut } = useAuth();
 *   if (!isAuthenticated) return null;
 *   return <span>{user.name}</span>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);

  if (!ctx) {
    // Return a safe default when used outside AuthProvider
    return {
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isPreviewMode: false,
      previewMode: null,
      signIn: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
      signUp: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
      signOut: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
      updateUser: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
      forgotPassword: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
      resetPassword: async () => { throw new Error('useAuth must be used within an AuthProvider'); },
    };
  }

  return ctx;
}
