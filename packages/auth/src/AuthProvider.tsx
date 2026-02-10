/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { AuthUser, AuthClient, AuthProviderConfig } from './types';
import { AuthCtx, type AuthContextValue } from './AuthContext';
import { createAuthClient } from './createAuthClient';

export interface AuthProviderProps extends AuthProviderConfig {
  children: React.ReactNode;
  /**
   * Whether authentication is enabled.
   * When false, the provider will skip authentication checks and treat all users as authenticated.
   * Useful for development or demo environments where the server doesn't have authentication enabled.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Authentication context provider.
 *
 * Wraps the application to provide authentication state and methods
 * to all child components via the useAuth hook.
 *
 * @example
 * ```tsx
 * <AuthProvider authUrl="/api/auth">
 *   <App />
 * </AuthProvider>
 * ```
 * 
 * @example With disabled auth (development mode)
 * ```tsx
 * <AuthProvider authUrl="/api/auth" enabled={false}>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({
  authUrl,
  client: externalClient,
  onAuthStateChange,
  enabled = true,
  children,
}: AuthProviderProps) {
  const client = useMemo<AuthClient>(
    () => externalClient ?? createAuthClient({ baseURL: authUrl }),
    [externalClient, authUrl],
  );

  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // If auth is disabled, automatically set as authenticated with a guest user
  const isAuthenticated = enabled 
    ? user !== null && session !== null
    : true;

  // Load session on mount (only if auth is enabled)
  useEffect(() => {
    if (!enabled) {
      // When auth is disabled, set a guest user and mark as loaded
      setUser({
        id: 'guest',
        email: 'guest@local',
        name: 'Guest User',
      });
      setSession({
        token: 'guest-token',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      });
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const result = await client.getSession();
        if (cancelled) return;
        if (result) {
          setUser(result.user);
          setSession(result.session);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSession();
    return () => { cancelled = true; };
  }, [client, enabled]);

  // Notify on auth state changes
  useEffect(() => {
    onAuthStateChange?.({
      user,
      session,
      isAuthenticated,
      isLoading,
      error,
    });
  }, [user, session, isAuthenticated, isLoading, error, onAuthStateChange]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.signIn({ email, password });
        setUser(result.user);
        setSession(result.session);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.signUp({ name, email, password });
        setUser(result.user);
        setSession(result.session);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await client.signOut();
      setUser(null);
      setSession(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const updateUser = useCallback(
    async (data: Partial<AuthUser>) => {
      setError(null);
      try {
        const updated = await client.updateUser(data);
        setUser(updated);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const forgotPassword = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await client.forgotPassword(email);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      setError(null);
      try {
        await client.resetPassword(token, newPassword);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isAuthenticated,
      isLoading,
      error,
      signIn,
      signUp,
      signOut,
      updateUser,
      forgotPassword,
      resetPassword,
    }),
    [user, session, isAuthenticated, isLoading, error, signIn, signUp, signOut, updateUser, forgotPassword, resetPassword],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
