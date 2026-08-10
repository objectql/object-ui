/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type React from 'react';
import type {
  AuthUser as SpecAuthUser,
  DelegableScope,
  DelegableAdminScope,
} from '@objectstack/spec/contracts';
import type { TenancyPosture } from '@objectstack/spec/security';

/**
 * Authentication types for @object-ui/auth
 */

/**
 * The spec's tenancy posture vocabulary, verbatim (framework ADR-0105 D1).
 *
 * - `single` — one organization, no wall.
 * - `group` — one shared database, organization as membership boundary:
 *   reads span every organization the caller belongs to, writes land in the
 *   ACTIVE organization.
 * - `isolated` — hard per-organization walls (the pre-ADR-0105 `multi`).
 *
 * Was a hand-written union here until objectstack#4115 batch 5; it agreed with
 * the spec member-for-member, which is exactly the state one spec release away
 * from drifting.
 */
export type { TenancyPosture };

/**
 * [framework ADR-0090 D12 / ADR-0105 D8] What the caller may delegate, as
 * returned by `GET /api/v1/security/my-delegable-scope`.
 *
 * A picker NARROWS with this; the server-side gate still decides. Empty lists
 * mean "no delegated authority" — render no placement rather than a permissive
 * form the server would refuse.
 *
 * The spec owns the wire contract, so this is its binding rather than a copy
 * (objectstack#4115). `DelegableAdminScope` comes along for the ride — the
 * local copy had spelled that element type out inline.
 */
export type { DelegableScope, DelegableAdminScope };

/**
 * Authenticated user information, as the BROWSER holds it.
 *
 * Derives from the spec's `AuthUser` (the `IAuthService` principal: `id`,
 * `email`, `name`, plus the `positions` / `tenantId` an authorization decision
 * needs) and adds the display-only fields better-auth returns to the client.
 * Extending rather than re-declaring means a new spec field lands here the day
 * the spec adds it, instead of silently going missing (objectstack#4115).
 *
 * The index signature is deliberate: better-auth projects an app's custom user
 * columns onto this object and no local type can enumerate them.
 */
export interface AuthUser extends SpecAuthUser {
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

/**
 * The credential bundle the BROWSER holds after a successful sign-in.
 *
 * Not the spec's `AuthSession` and deliberately not named after it
 * (objectstack#4115): the spec models the SERVER's session record —
 * `{ id, userId, expiresAt: ISO string, token? }`, keyed by a session id the
 * client never sees — while this is the token set better-auth hands back:
 * `token` is REQUIRED, `expiresAt` is a JS `Date`, and `refreshToken` has no
 * spec counterpart at all. The two are mutually unassignable, so a re-export
 * would have been a silent contract swap rather than a burn-down.
 */
export interface AuthClientSession {
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
  session: AuthClientSession | null;
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
    /**
     * RESERVED — declared so the `/auth/config` payload types cleanly, and
     * consumed by nothing in this repository. Enabling it server-side adds
     * **no** passkey entry point to the login page, because there is no passkey
     * sign-in or registration UI for it to gate. Contrast `sso`,
     * `phoneNumberOtp` and `deviceAuthorization` below, which each gate a real
     * surface.
     *
     * Building the flow is objectui#4179, filed unscheduled. This marking
     * follows the maintainer's 2026-08-03 ruling on objectui#2514: document the
     * flag as reserved now, build the UI when the login surface gets roadmap
     * time (at which point it renders driven by this flag).
     *
     * Pinned by `__tests__/reserved-auth-features.test.ts`. That pin fails the
     * moment a consumer appears, because the declaration, this doc comment and
     * `README.md`'s reserved section have to retire in one PR — see the pin's
     * docblock for the retirement checklist.
     */
    passkeys?: boolean;
    /**
     * RESERVED — declared so the `/auth/config` payload types cleanly, and
     * consumed by nothing in this repository. Enabling it server-side adds
     * **no** "email me a sign-in link" entry point to the login page: there is
     * neither a magic-link request step nor a route that consumes the emailed
     * token.
     *
     * Same ruling, same follow-up card and same pin as `passkeys` above
     * (objectui#2514 / objectui#4179 /
     * `__tests__/reserved-auth-features.test.ts`).
     */
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
    /**
     * better-auth deviceAuthorization plugin mounted server-side
     * (`auth.plugins.deviceAuthorization`, opt-in / off by default). Gates the
     * RFC 8628 device-approval page: when falsy the `/device`, `/device/approve`
     * and `/device/deny` endpoints aren't wired, so the UI shows an
     * "not enabled" notice instead of a form that only fails on submit
     * (framework#2874 / objectui#2513).
     */
    deviceAuthorization?: boolean;
    /**
     * Which tenancy posture the deployment runs (framework ADR-0105 D1).
     * Non-boolean by design: `multiOrgEnabled` stays the capability gate
     * ("is an organization wall enforced at all?"), while this key only tells
     * the console HOW to render organization context. Under `group` the org
     * switcher picks the WRITE target and reads span every organization the
     * member belongs to, so group-only affordances (write-context labeling,
     * org attribution in list views) key off `tenancyPosture === 'group'`.
     * Absent (older server / config not yet fetched) ⇒ no group affordances.
     */
    tenancyPosture?: TenancyPosture;
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
  signIn: (credentials: SignInCredentials) => Promise<{ user: AuthUser; session: AuthClientSession }>;
  /** Sign up with email/password. `session` is null when email verification is required. */
  signUp: (data: SignUpData) => Promise<{ user: AuthUser; session: AuthClientSession | null; requiresVerification: boolean }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Get current session */
  getSession: () => Promise<{ user: AuthUser; session: AuthClientSession } | null>;
  /** Reset password request */
  forgotPassword: (email: string) => Promise<void>;
  /** Send (or resend) the email-verification link to the given address. */
  sendVerificationEmail: (email: string, callbackURL?: string) => Promise<void>;
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /** framework#2780 — request a sign-in/verification OTP SMS for the phone number. */
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  /** framework#2780 — verify a phone OTP; signs in the number's user. */
  signInWithPhoneOtp: (phoneNumber: string, code: string) => Promise<{ user: AuthUser; session: AuthClientSession }>;
  /** framework#2780 — sign in with phone number + password (no SMS; gated by `features.phoneNumber`). */
  signInWithPhonePassword: (phoneNumber: string, password: string) => Promise<{ user: AuthUser; session: AuthClientSession }>;
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
  /**
   * [framework ADR-0090 D12 / ADR-0105 D8] What the CALLER may delegate —
   * `GET /api/v1/security/my-delegable-scope`. Used to narrow the
   * scoped-invitation placement pickers to the units and positions the issuer
   * can actually hand out. `null` when the deployment doesn't expose it (no
   * delegated-administration runtime ⇒ 501, or the request failed) — consumers
   * then hide placement rather than offering something that would be refused.
   */
  describeDelegableScope: () => Promise<DelegableScope | null>;
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
  inviteMember: (data: {
    organizationId: string;
    email: string;
    role: string;
    /**
     * [framework ADR-0105 D8] Placement intent — the business unit the invitee
     * lands in and the positions they are assigned on acceptance. Authorized
     * SERVER-side against the ISSUER's `adminScope`: an out-of-scope pair
     * rejects the whole invitation, so this is a request, never an authority.
     */
    businessUnitId?: string;
    positions?: string[];
  }) => Promise<AuthInvitation>;
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

/**
 * Configuration for the React `<AuthProvider>` component.
 *
 * Deliberately NOT `AuthProviderConfig` (objectstack#4115): the spec owns that
 * name for the OAuth/OIDC provider registration `{ id, clientId, clientSecret,
 * scope? }` — same domain, same word "auth provider", completely different
 * object. That is the collision most likely to be read as canonical by the next
 * session, so this one carries a local name and a tripwire
 * (`__tests__/auth-spec-parity.test.ts`).
 */
export interface AuthProviderOptions {
  /** Authentication server URL */
  authUrl: string;
  /** Auth client instance (if already created) */
  client?: AuthClient;
  /** Callback when auth state changes */
  onAuthStateChange?: (state: AuthState) => void;
  /** Path to redirect to when not authenticated */
  redirectTo?: string;
}
