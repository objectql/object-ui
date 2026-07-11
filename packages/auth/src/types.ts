/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type React from 'react';

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
  /** Authentication server URL (e.g., "/api/v1/auth") */
  baseURL: string;
  /** Custom fetch function for requests */
  fetchFn?: typeof fetch;
}

/** Social/OIDC provider exposed by the server's `/auth/config` endpoint */
export interface AuthSocialProvider {
  /** Provider id (e.g. 'google', 'github', 'microsoft') */
  id: string;
  /** Display name (e.g. 'Google') */
  name: string;
  /** Whether the provider is enabled on the server */
  enabled: boolean;
  /** 'social' uses better-auth built-in providers, 'oidc' uses generic oauth2 */
  type?: 'social' | 'oidc';
}

/** Public auth configuration returned by the server */
export interface AuthPublicConfig {
  emailPassword?: {
    enabled: boolean;
    disableSignUp?: boolean;
    requireEmailVerification?: boolean;
  };
  socialProviders?: AuthSocialProvider[];
  features?: {
    twoFactor?: boolean;
    passkeys?: boolean;
    magicLink?: boolean;
    organization?: boolean;
    /**
     * Whether enterprise SSO (domain-routed `@better-auth/sso`) is wired on
     * the server. When falsy the `/sign-in/sso` route isn't mounted, so the
     * login UI hides the "Sign in with SSO" button instead of rendering one
     * that only fails at click time with "No SSO provider is configured".
     */
    sso?: boolean;
    /**
     * SSO-only ("enforced") login. When `true`, the team/console login is
     * locked to the configured IdP (cloud-as-IdP or an external OIDC/SAML
     * provider): the login UI hides the local email/password form and the
     * sign-up link, showing the federated button only — plus an understated
     * break-glass "use a password instead" link so the env owner / local admin
     * can still reach the password form during an IdP outage. The server keeps
     * `emailPassword.enabled` true (managed users simply hold no credential),
     * so this is purely a UI affordance over the same endpoints.
     */
    ssoEnforced?: boolean;
    /**
     * When `false`, the server's `beforeCreateOrganization` hook blocks
     * creation of new organizations. The org plugin endpoints (list, update,
     * invite-accept) still work — only fresh creation is forbidden.
     */
    multiOrgEnabled?: boolean;
    /**
     * Phone-number sign-in enabled server-side (better-auth phoneNumber
     * plugin — phone + password, framework#2766).
     */
    phoneNumber?: boolean;
    /**
     * Phone-number OTP sign-in / self-service reset available — requires the
     * phoneNumber plugin plus a deliverable SMS service (framework#2780).
     * Gates the "sign in with verification code" mode and the phone branch
     * of the forgot-password form; falsy hides them so we never render an
     * entry point whose code can never arrive.
     */
    phoneNumberOtp?: boolean;
    /**
     * better-auth admin plugin mounted server-side (`auth.plugins.admin`;
     * SCIM forces it on). Gates the admin user-management surfaces — the
     * sys_user create/set-password actions and the identity import wizard
     * entry (framework#2766 / #2782).
     */
    admin?: boolean;
  };
}

/** Options when initiating a third-party sign-in */
export interface SignInWithProviderOptions {
  /** URL the provider redirects to after a successful authentication */
  callbackURL?: string;
  /** URL the provider redirects to on error */
  errorCallbackURL?: string;
  /** Provider type — 'social' (default) or 'oidc' for generic oauth2 */
  type?: 'social' | 'oidc';
}

/** Auth client interface - abstracts the underlying auth library */
export interface AuthClient {
  /** Sign in with email/password */
  signIn: (credentials: SignInCredentials) => Promise<{ user: AuthUser; session: AuthSession }>;
  /** Sign up with email/password. `session` is null when email verification is required. */
  signUp: (data: SignUpData) => Promise<{ user: AuthUser; session: AuthSession | null; requiresVerification: boolean }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Get current session */
  getSession: () => Promise<{ user: AuthUser; session: AuthSession } | null>;
  /** Reset password request */
  forgotPassword: (email: string) => Promise<void>;
  /** Send (or resend) the email-verification link to the given address. */
  sendVerificationEmail: (email: string, callbackURL?: string) => Promise<void>;
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /** framework#2780 — request a sign-in/verification OTP SMS for the phone number. */
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  /** framework#2780 — verify a phone OTP; signs in the number's user. */
  signInWithPhoneOtp: (phoneNumber: string, code: string) => Promise<{ user: AuthUser; session: AuthSession }>;
  /** framework#2780 — request a password-reset OTP SMS for the phone number. */
  requestPhonePasswordReset: (phoneNumber: string) => Promise<void>;
  /** framework#2780 — reset the password using a phone OTP. */
  resetPasswordWithPhoneOtp: (phoneNumber: string, otp: string, newPassword: string) => Promise<void>;
  /** Change password (requires current password). For users who already have a local password. */
  changePassword: (currentPassword: string, newPassword: string, options?: { revokeOtherSessions?: boolean }) => Promise<void>;
  /** ADR-0069 — start TOTP enrollment; returns the otpauth URI + backup codes. */
  enrollTotp: (password: string) => Promise<{ totpURI: string; backupCodes: string[] }>;
  /** ADR-0069 — verify the first TOTP code to activate enrollment. */
  verifyTotp: (code: string) => Promise<void>;
  /** Set an INITIAL local password for SSO-onboarded users with no credential account. */
  setInitialPassword: (newPassword: string) => Promise<void>;
  /** Whether the current user has a local credential password configured. */
  hasLocalPassword: () => Promise<boolean>;
  /** Update user profile */
  updateUser: (data: Partial<AuthUser>) => Promise<AuthUser>;

  /** Fetch the public auth configuration from the server (providers, features) */
  getConfig: () => Promise<AuthPublicConfig>;
  /** Initiate sign-in with a third-party provider (Google, GitHub, OIDC, etc.) */
  signInWithProvider: (providerId: string, options?: SignInWithProviderOptions) => Promise<void>;

  // --- Organization / Workspace methods ---

  /** List organizations the current user belongs to */
  listOrganizations: () => Promise<AuthOrganization[]>;
  /** Create a new organization */
  createOrganization: (data: { name: string; slug: string; logo?: string }) => Promise<AuthOrganization>;
  /** Set the active organization for the current session */
  setActiveOrganization: (orgId: string) => Promise<AuthOrganization | null>;
  /** Get the full active organization object */
  getActiveOrganization: () => Promise<AuthOrganization | null>;
  /** Get the current user's member row for the active organization (role, etc.) */
  getActiveMember: () => Promise<AuthOrganizationMember | null>;
  /** Get members of an organization */
  getMembers: (orgId: string) => Promise<AuthOrganizationMember[]>;
  /** Invite a member to an organization */
  inviteMember: (data: { organizationId: string; email: string; role: string }) => Promise<AuthInvitation>;
  /** Remove a member from an organization */
  removeMember: (data: { organizationId: string; memberIdOrUserId: string }) => Promise<void>;
  /** Update a member's role */
  updateMemberRole: (data: { organizationId: string; memberId: string; role: string }) => Promise<void>;
  /** Update organization details */
  updateOrganization: (orgId: string, data: Partial<Pick<AuthOrganization, 'name' | 'slug' | 'logo' | 'metadata'>>) => Promise<AuthOrganization>;
  /** Delete an organization */
  deleteOrganization: (orgId: string) => Promise<void>;
  /** Current user leaves the given organization */
  leaveOrganization: (orgId: string) => Promise<void>;

  // --- Invitation methods ---

  /** List pending invitations for an organization (owner/admin) */
  listInvitations: (orgId: string) => Promise<AuthInvitation[]>;
  /** Cancel an invitation (owner/admin) */
  cancelInvitation: (invitationId: string) => Promise<void>;
  /** Get an invitation by id (used by accept-invitation landing page) */
  getInvitation: (invitationId: string) => Promise<AuthInvitation>;
  /** Accept an invitation as the current user */
  acceptInvitation: (invitationId: string) => Promise<void>;
  /** Reject an invitation as the current user */
  rejectInvitation: (invitationId: string) => Promise<void>;
  /** List invitations addressed to the current user */
  listUserInvitations: () => Promise<AuthInvitation[]>;
}

/**
 * Preview mode configuration options.
 * When preview mode is active, the auth provider auto-logs in a simulated user
 * and bypasses login/registration screens.
 */
export interface PreviewModeOptions {
  /** Auto-login as simulated user, skipping login/registration pages */
  autoLogin?: boolean;
  /** Permission role for the simulated preview user */
  simulatedRole?: 'admin' | 'user' | 'viewer';
  /** Display name for the simulated preview user */
  simulatedUserName?: string;
  /** Restrict the preview session to read-only operations */
  readOnly?: boolean;
  /** Preview session duration in seconds (0 = no expiration) */
  expiresInSeconds?: number;
  /** Banner message displayed in the UI during preview mode */
  bannerMessage?: string;
}

/** Props for custom link components used in auth forms (e.g. React Router's Link) */
export interface AuthLinkComponentProps {
  /** Target URL */
  href: string;
  /** CSS class names */
  className?: string;
  /** Link content */
  children: React.ReactNode;
}

/** Organization (workspace/tenant) */
export interface AuthOrganization {
  /** Unique organization identifier */
  id: string;
  /** Organization display name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Organization logo URL */
  logo?: string | null;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt?: string;
}

/** Organization invitation */
export interface AuthInvitation {
  /** Invitation record ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Invited email address */
  email: string;
  /** Role to be granted upon acceptance */
  role: string;
  /** Status: 'pending' | 'accepted' | 'rejected' | 'canceled' */
  status: string;
  /** Expiration timestamp */
  expiresAt?: string;
  /** ID of the inviting user */
  inviterId?: string;
  /** Organization snapshot (populated by getInvitation) */
  organizationName?: string;
  /** Organization slug snapshot */
  organizationSlug?: string;
}

/** Organization member */
export interface AuthOrganizationMember {
  /** Member record ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** User ID */
  userId: string;
  /** Role within the organization */
  role: string;
  /** User info (populated on list) */
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  /** Creation timestamp */
  createdAt?: string;
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
