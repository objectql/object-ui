/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { authGateEvents } from './auth-gate-events';
import type { AuthUser, AuthClient, AuthProviderConfig, PreviewModeOptions, AuthOrganization, AuthOrganizationMember, AuthInvitation, AuthPublicConfig, SignInWithProviderOptions } from './types';
import { AuthCtx, type AuthContextValue } from './AuthContext';
import { createAuthClient } from './createAuthClient';
import { ActiveOrganizationStorage } from './createAuthenticatedFetch';

export interface AuthProviderProps extends AuthProviderConfig {
  children: React.ReactNode;
  /**
   * Whether authentication is enabled.
   * When false, the provider will skip authentication checks and treat all users as authenticated.
   * Useful for development or demo environments where the server doesn't have authentication enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * Preview mode configuration.
   * When provided, the auth provider auto-logs in a simulated user and bypasses
   * login/registration screens. Useful for marketplace demos and app showcases.
   */
  previewMode?: PreviewModeOptions;
}

/**
 * Authentication context provider.
 *
 * Wraps the application to provide authentication state and methods
 * to all child components via the useAuth hook.
 *
 * @example
 * ```tsx
 * <AuthProvider authUrl="/api/v1/auth">
 *   <App />
 * </AuthProvider>
 * ```
 * 
 * @example With disabled auth (development mode)
 * ```tsx
 * <AuthProvider authUrl="/api/v1/auth" enabled={false}>
 *   <App />
 * </AuthProvider>
 * ```
 * @example With preview mode (marketplace demo)
 * ```tsx
 * <AuthProvider authUrl="/api/v1/auth" previewMode={{ simulatedRole: 'admin', bannerMessage: 'Demo mode' }}>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({
  authUrl,
  client: externalClient,
  onAuthStateChange,
  enabled = true,
  previewMode,
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
  const [remediationRequired, setRemediationRequired] = useState<{ code: string; message: string } | null>(null);

  // Organization / workspace state
  const [organizations, setOrganizations] = useState<AuthOrganization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<AuthOrganization | null>(null);
  const [activeMember, setActiveMember] = useState<AuthOrganizationMember | null>(null);
  const [isOrganizationsLoading, setIsOrganizationsLoading] = useState(false);

  // Determine if we're in preview mode
  const isPreviewMode = previewMode != null;

  // If auth is disabled or in preview mode, automatically set as authenticated
  const isAuthenticated = (enabled && !isPreviewMode)
    ? user !== null && session !== null
    : true;

  // Load session on mount (only if auth is enabled and not in preview mode)
  useEffect(() => {
    if (isPreviewMode) {
      // Preview mode: simulate a user based on previewMode config
      const role = previewMode.simulatedRole ?? 'admin';
      const name = previewMode.simulatedUserName ?? 'Preview User';
      const expiresInSeconds = previewMode.expiresInSeconds ?? 0;
      setUser({
        id: 'preview-user',
        email: 'preview@preview.local',
        name,
        role,
        roles: [role],
      });
      setSession({
        token: 'preview-token',
        expiresAt: expiresInSeconds > 0
          ? new Date(Date.now() + expiresInSeconds * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      setIsLoading(false);
      return;
    }

    if (!enabled) {
      // When auth is disabled, set a guest user with admin role and mark as loaded.
      // Admin role ensures all features are accessible in demo/dev environments.
      setUser({
        id: 'guest',
        email: 'guest@local',
        name: 'Guest User',
        role: 'admin',
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
  }, [client, enabled, isPreviewMode, previewMode]);

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
        if (result.requiresVerification) {
          // No session was created — the user must verify their email before
          // they can sign in. Leave auth state untouched so the caller can
          // render a "check your inbox" UI without bouncing through guards.
          return { requiresVerification: true };
        }
        setUser(result.user);
        setSession(result.session);
        return { requiresVerification: false };
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

  const sendVerificationEmail = useCallback(
    async (email: string, callbackURL?: string) => {
      setError(null);
      try {
        await client.sendVerificationEmail(email, callbackURL);
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

  // --- Phone-number OTP (framework#2780) --------------------------------

  const sendPhoneOtp = useCallback(
    async (phoneNumber: string) => {
      setError(null);
      try {
        await client.sendPhoneOtp(phoneNumber);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const signInWithPhoneOtp = useCallback(
    async (phoneNumber: string, code: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.signInWithPhoneOtp(phoneNumber, code);
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

  const requestPhonePasswordReset = useCallback(
    async (phoneNumber: string) => {
      setError(null);
      try {
        await client.requestPhonePasswordReset(phoneNumber);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const resetPasswordWithPhoneOtp = useCallback(
    async (phoneNumber: string, otp: string, newPassword: string) => {
      setError(null);
      try {
        await client.resetPasswordWithPhoneOtp(phoneNumber, otp, newPassword);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  // ADR-0069 — the API fetch interceptor emits an auth-policy gate; raise the
  // remediation overlay. Don't override an already-shown gate.
  useEffect(() => {
    return authGateEvents.subscribe((gate) => {
      setRemediationRequired((prev) => prev ?? gate);
    });
  }, []);

  const enrollTotp = useCallback((password: string) => client.enrollTotp(password), [client]);
  const verifyTotp = useCallback((code: string) => client.verifyTotp(code), [client]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, options?: { revokeOtherSessions?: boolean }) => {
      setError(null);
      try {
        await client.changePassword(currentPassword, newPassword, options);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const setInitialPassword = useCallback(
    async (newPassword: string) => {
      setError(null);
      try {
        await client.setInitialPassword(newPassword);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const hasLocalPassword = useCallback(
    (): Promise<boolean> => client.hasLocalPassword(),
    [client],
  );

  const getAuthConfig = useCallback(
    (): Promise<AuthPublicConfig> => client.getConfig(),
    [client],
  );

  const signInWithProvider = useCallback(
    async (providerId: string, options?: SignInWithProviderOptions) => {
      setError(null);
      try {
        await client.signInWithProvider(providerId, options);
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  // --- Organization methods ---

  const refreshOrganizations = useCallback(async (isCancelled?: () => boolean) => {
    if (!enabled || isPreviewMode) return;
    setIsOrganizationsLoading(true);
    try {
      const orgs = await client.listOrganizations();
      if (isCancelled?.()) return orgs;
      setOrganizations(orgs);
      // If no active org is set but orgs exist, try to get active from server
      if (orgs.length > 0 && !activeOrganization) {
        let active: AuthOrganization | null = null;
        try {
          active = await client.getActiveOrganization();
        } catch {
          // No active org set — that's fine
          active = null;
        }
        // Single-membership repair (ADR-0081): a session created before the
        // server-side active-org stamp existed carries no active org even
        // though the user belongs to exactly one — activate it so org-scoped
        // UI ({current_org_id} nav links, org endpoints) works without a
        // re-login. With multiple orgs the choice stays with the user.
        if (!active && orgs.length === 1) {
          try {
            active = await client.setActiveOrganization(orgs[0].id);
          } catch {
            active = null;
          }
        }
        if (active && !isCancelled?.()) {
          setActiveOrganization(active);
          ActiveOrganizationStorage.set(active.id);
        }
      }
      return orgs;
    } catch (err) {
      // A route change / unmount racing the in-flight request is not a real
      // failure — only warn when this call is still the one that matters.
      if (!isCancelled?.()) {
        console.warn('[AuthProvider] Failed to load organizations:', err);
      }
    } finally {
      if (!isCancelled?.()) {
        setIsOrganizationsLoading(false);
      }
    }
  }, [client, enabled, isPreviewMode, activeOrganization]);

  // Refresh the active member row whenever the active org changes. Used by
  // role-gated UI (e.g. the marketplace install entries). Preview / no-auth
  // modes are treated as admin so dev/demo workflows keep all features.
  const refreshActiveMember = useCallback(async () => {
    if (!enabled || isPreviewMode) {
      const role = isPreviewMode ? (previewMode?.simulatedRole ?? 'admin') : 'admin';
      setActiveMember({
        id: 'preview-member',
        organizationId: activeOrganization?.id ?? 'preview-org',
        userId: 'preview-user',
        role,
      } as AuthOrganizationMember);
      return;
    }
    if (!activeOrganization) {
      setActiveMember(null);
      return;
    }
    try {
      const member = await client.getActiveMember();
      setActiveMember(member);
    } catch (err) {
      console.warn('[AuthProvider] Failed to load active member:', err);
      setActiveMember(null);
    }
  }, [client, enabled, isPreviewMode, previewMode, activeOrganization]);

  useEffect(() => {
    refreshActiveMember();
  }, [refreshActiveMember]);

  // Load organizations once user is authenticated
  useEffect(() => {
    if (!(user && enabled && !isPreviewMode)) return;
    let cancelled = false;
    refreshOrganizations(() => cancelled);
    return () => { cancelled = true; };
  }, [user, enabled, isPreviewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchOrganization = useCallback(
    async (orgId: string) => {
      setError(null);
      try {
        const org = await client.setActiveOrganization(orgId);
        setActiveOrganization(org);
        // Persist for header injection
        if (org) {
          ActiveOrganizationStorage.set(org.id);
        } else {
          ActiveOrganizationStorage.clear();
        }
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client],
  );

  const createOrganization = useCallback(
    async (data: { name: string; slug: string; logo?: string }): Promise<AuthOrganization> => {
      setError(null);
      try {
        const org = await client.createOrganization(data);
        // Refresh the list and set as active
        await refreshOrganizations();
        await switchOrganization(org.id);
        return org;
      } catch (err) {
        const authError = err instanceof Error ? err : new Error(String(err));
        setError(authError);
        throw authError;
      }
    },
    [client, refreshOrganizations, switchOrganization],
  );

  const updateOrganization = useCallback(
    async (orgId: string, data: Partial<Pick<AuthOrganization, 'name' | 'slug' | 'logo' | 'metadata'>>) => {
      const updated = await client.updateOrganization(orgId, data);
      // Refresh local list & active org reference if it matches
      await refreshOrganizations();
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(updated);
      }
      return updated;
    },
    [client, refreshOrganizations, activeOrganization],
  );

  const deleteOrganization = useCallback(
    async (orgId: string) => {
      await client.deleteOrganization(orgId);
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(null);
        ActiveOrganizationStorage.clear();
      }
      await refreshOrganizations();
    },
    [client, activeOrganization, refreshOrganizations],
  );

  const leaveOrganization = useCallback(
    async (orgId: string) => {
      await client.leaveOrganization(orgId);
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(null);
        ActiveOrganizationStorage.clear();
      }
      await refreshOrganizations();
    },
    [client, activeOrganization, refreshOrganizations],
  );

  const getMembers = useCallback(
    (orgId: string): Promise<AuthOrganizationMember[]> => client.getMembers(orgId),
    [client],
  );

  const inviteMember = useCallback(
    (data: { organizationId: string; email: string; role: string }): Promise<AuthInvitation> =>
      client.inviteMember(data),
    [client],
  );

  const removeMember = useCallback(
    (data: { organizationId: string; memberIdOrUserId: string }): Promise<void> =>
      client.removeMember(data),
    [client],
  );

  const updateMemberRole = useCallback(
    (data: { organizationId: string; memberId: string; role: string }): Promise<void> =>
      client.updateMemberRole(data),
    [client],
  );

  const listInvitations = useCallback(
    (orgId: string): Promise<AuthInvitation[]> => client.listInvitations(orgId),
    [client],
  );

  const cancelInvitation = useCallback(
    (invitationId: string): Promise<void> => client.cancelInvitation(invitationId),
    [client],
  );

  const getInvitation = useCallback(
    (invitationId: string): Promise<AuthInvitation> => client.getInvitation(invitationId),
    [client],
  );

  const acceptInvitation = useCallback(
    async (invitationId: string): Promise<void> => {
      await client.acceptInvitation(invitationId);
      await refreshOrganizations();
    },
    [client, refreshOrganizations],
  );

  const rejectInvitation = useCallback(
    (invitationId: string): Promise<void> => client.rejectInvitation(invitationId),
    [client],
  );

  const listUserInvitations = useCallback(
    (): Promise<AuthInvitation[]> => client.listUserInvitations(),
    [client],
  );

  // Real auth is "enabled" only when the prop is true AND we're not in preview mode.
  // Guest mode (enabled=false) and preview mode both have hardcoded `isAuthenticated`
  // and a no-op signOut backend, so consumers should hide sign-out UIs.
  const isAuthEnabled = enabled && !isPreviewMode;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isAuthenticated,
      isAuthEnabled,
      isLoading,
      error,
      isPreviewMode,
      previewMode: isPreviewMode ? previewMode : null,
      signIn,
      signUp,
      signOut,
      updateUser,
      forgotPassword,
      sendVerificationEmail,
      resetPassword,
      sendPhoneOtp,
      signInWithPhoneOtp,
      requestPhonePasswordReset,
      resetPasswordWithPhoneOtp,
      changePassword,
      remediationRequired,
      setRemediationRequired,
      enrollTotp,
      verifyTotp,
      setInitialPassword,
      hasLocalPassword,
      getAuthConfig,
      signInWithProvider,
      organizations,
      activeOrganization,
      activeMember,
      isOrganizationsLoading,
      switchOrganization,
      createOrganization,
      refreshOrganizations,
      updateOrganization,
      deleteOrganization,
      leaveOrganization,
      getMembers,
      inviteMember,
      removeMember,
      updateMemberRole,
      listInvitations,
      cancelInvitation,
      getInvitation,
      acceptInvitation,
      rejectInvitation,
      listUserInvitations,
    }),
    [
      user, session, isAuthenticated, isAuthEnabled, isLoading, error, isPreviewMode, previewMode,
      signIn, signUp, signOut, updateUser, forgotPassword, sendVerificationEmail, resetPassword, changePassword, setInitialPassword, hasLocalPassword, getAuthConfig, signInWithProvider,
      sendPhoneOtp, signInWithPhoneOtp, requestPhonePasswordReset, resetPasswordWithPhoneOtp,
      remediationRequired, enrollTotp, verifyTotp,
      organizations, activeOrganization, activeMember, isOrganizationsLoading, switchOrganization, createOrganization, refreshOrganizations,
      updateOrganization, deleteOrganization, leaveOrganization,
      getMembers, inviteMember, removeMember, updateMemberRole,
      listInvitations, cancelInvitation, getInvitation, acceptInvitation, rejectInvitation, listUserInvitations,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
