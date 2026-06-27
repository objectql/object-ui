/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext } from 'react';
import type { AuthUser, AuthSession, PreviewModeOptions, AuthOrganization, AuthOrganizationMember, AuthInvitation, AuthPublicConfig, SignInWithProviderOptions } from './types';

export interface AuthContextValue {
  /** Current authenticated user */
  user: AuthUser | null;
  /** Current session information */
  session: AuthSession | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /**
   * Whether real authentication is enabled in this environment.
   * - `true`: real auth backend is in use; sign-in / sign-out are meaningful.
   * - `false`: auth is disabled (guest mode) or running in preview/demo mode.
   *   Sign-out has no real effect; UIs should hide or disable the action.
   */
  isAuthEnabled: boolean;
  /** Whether auth state is loading */
  isLoading: boolean;
  /** Authentication error */
  error: Error | null;
  /** Whether the app is running in preview mode */
  isPreviewMode: boolean;
  /** Preview mode configuration (only set when isPreviewMode is true) */
  previewMode: PreviewModeOptions | null;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign up with name, email, and password.
   *  Returns `{ requiresVerification: true }` when the server accepted the
   *  account but is gating sign-in on email verification; callers should
   *  show a "check your inbox" UI instead of navigating to a protected page. */
  signUp: (name: string, email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Update user profile */
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  /** Request password reset */
  forgotPassword: (email: string) => Promise<void>;
  /** Send (or resend) the email-verification link to the given address. */
  sendVerificationEmail: (email: string, callbackURL?: string) => Promise<void>;
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /**
   * Change the local (email/password) password. Requires the current
   * password. Use this when `hasLocalPassword()` returns true.
   */
  changePassword: (currentPassword: string, newPassword: string, options?: { revokeOtherSessions?: boolean }) => Promise<void>;
  /**
   * ADR-0069 — an authentication-policy gate the user must clear before
   * continuing (e.g. expired password, required MFA enrollment), or null. Set
   * by the API fetch interceptor; consumed by the remediation overlay.
   */
  remediationRequired: { code: string; message: string } | null;
  /** Clear (or set) the remediation gate — overlay calls this on success. */
  setRemediationRequired: (gate: { code: string; message: string } | null) => void;
  /** ADR-0069 — start TOTP enrollment; returns the otpauth URI + backup codes. */
  enrollTotp: (password: string) => Promise<{ totpURI: string; backupCodes: string[] }>;
  /** ADR-0069 — verify the first TOTP code to activate enrollment. */
  verifyTotp: (code: string) => Promise<void>;
  /**
   * Set an INITIAL local password for an SSO-onboarded user that has no
   * credential account yet. Refuses if a password already exists — call
   * `changePassword` in that case. Use after `hasLocalPassword()` returns
   * false.
   */
  setInitialPassword: (newPassword: string) => Promise<void>;
  /** Whether the current user has a local (credential) password set. */
  hasLocalPassword: () => Promise<boolean>;
  /** Fetch the public auth configuration (providers, features) */
  getAuthConfig: () => Promise<AuthPublicConfig>;
  /** Initiate sign-in with a third-party provider (Google, GitHub, OIDC, etc.) */
  signInWithProvider: (providerId: string, options?: SignInWithProviderOptions) => Promise<void>;

  // --- Organization / Workspace ---

  /** All organizations the user belongs to */
  organizations: AuthOrganization[];
  /** Currently active organization */
  activeOrganization: AuthOrganization | null;
  /** Current user's member row for the active organization (carries role). Null until loaded or when there is no active org. */
  activeMember: AuthOrganizationMember | null;
  /** Whether organizations are loading */
  isOrganizationsLoading: boolean;
  /** Switch the active organization (workspace) */
  switchOrganization: (orgId: string) => Promise<void>;
  /** Create a new organization */
  createOrganization: (data: { name: string; slug: string; logo?: string }) => Promise<AuthOrganization>;
  /** Refresh the organizations list */
  refreshOrganizations: () => Promise<void>;
  /** Update organization details (owner/admin) */
  updateOrganization: (orgId: string, data: Partial<Pick<AuthOrganization, 'name' | 'slug' | 'logo' | 'metadata'>>) => Promise<AuthOrganization>;
  /** Delete an organization (owner) */
  deleteOrganization: (orgId: string) => Promise<void>;
  /** Current user leaves the given organization */
  leaveOrganization: (orgId: string) => Promise<void>;

  // --- Members ---

  /** List members of an organization */
  getMembers: (orgId: string) => Promise<AuthOrganizationMember[]>;
  /** Invite a user by email */
  inviteMember: (data: { organizationId: string; email: string; role: string }) => Promise<AuthInvitation>;
  /** Remove a member by id */
  removeMember: (data: { organizationId: string; memberIdOrUserId: string }) => Promise<void>;
  /** Update a member's role */
  updateMemberRole: (data: { organizationId: string; memberId: string; role: string }) => Promise<void>;

  // --- Invitations ---

  /** List pending invitations for an organization */
  listInvitations: (orgId: string) => Promise<AuthInvitation[]>;
  /** Cancel an invitation */
  cancelInvitation: (invitationId: string) => Promise<void>;
  /** Get invitation details by id */
  getInvitation: (invitationId: string) => Promise<AuthInvitation>;
  /** Accept an invitation as the current user */
  acceptInvitation: (invitationId: string) => Promise<void>;
  /** Reject an invitation as the current user */
  rejectInvitation: (invitationId: string) => Promise<void>;
  /** List invitations addressed to the current user */
  listUserInvitations: () => Promise<AuthInvitation[]>;
}

export const AuthCtx = createContext<AuthContextValue | null>(null);
AuthCtx.displayName = 'AuthContext';
