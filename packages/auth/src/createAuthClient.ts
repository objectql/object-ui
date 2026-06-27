/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createAuthClient as createBetterAuthClient } from 'better-auth/client';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import type {
  AuthClient, AuthClientConfig, AuthUser, AuthSession, SignInCredentials, SignUpData,
  AuthOrganization, AuthOrganizationMember, AuthInvitation, AuthPublicConfig, SignInWithProviderOptions,
} from './types';

const TOKEN_STORAGE_KEY = 'auth-session-token';

/**
 * Simple token storage backed by localStorage.
 * Falls back to in-memory storage when localStorage is unavailable (SSR, tests).
 */
export const TokenStorage = {
  _memoryToken: null as string | null,

  get(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
      }
    } catch { /* SSR / test */ }
    return this._memoryToken;
  },

  set(token: string): void {
    this._memoryToken = token;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } catch { /* SSR / test */ }
  },

  clear(): void {
    this._memoryToken = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch { /* SSR / test */ }
  },
};

/**
 * Better-auth client error shape: a human message plus an HTTP status and an
 * optional machine-readable `code` (e.g. `INVALID_EMAIL_OR_PASSWORD`).
 */
interface BetterAuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

/**
 * Build an `Error` from a better-auth client error, preserving the machine
 * `code` on the thrown Error so callers (LoginForm/RegisterForm) can map it to
 * a localized message instead of surfacing the raw English server text. Falls
 * back to the server message, then the HTTP status.
 */
function toAuthError(error: BetterAuthErrorLike): Error & { code?: string } {
  const err = new Error(
    error.message ?? `Auth request failed with status ${error.status}`,
  ) as Error & { code?: string };
  if (error.code) err.code = error.code;
  return err;
}

/**
 * Resolve a baseURL (which may be relative or absolute) into the
 * `{ origin, basePath }` pair required by the better-auth client.
 *
 * - Absolute URLs (e.g. `http://localhost:3000/api/auth`) are split into origin + pathname.
 * - Relative paths (e.g. `/api/v1/auth`) use `window.location.origin` in
 *   browser environments, falling back to `http://localhost` elsewhere.
 */
function resolveAuthURL(baseURL: string): { origin: string; basePath: string } {
  try {
    const url = new URL(baseURL);
    return { origin: url.origin, basePath: url.pathname.replace(/\/$/, '') };
  } catch {
    // Relative URL – resolve against the current origin when available
    const origin = getWindowOrigin() ?? 'http://localhost';
    return { origin, basePath: baseURL.replace(/\/$/, '') };
  }
}

/** Safely read window.location.origin when available (browser environments). */
function getWindowOrigin(): string | undefined {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch {
    // window may be defined but accessing location can throw in some SSR environments
  }
  return undefined;
}

/**
 * Resolve the redirect URL appended to password-reset emails as
 * `?callbackURL=<value>`. better-auth sends users to `<value>?token=…`
 * after verifying the token, so the value must point at the SPA's
 * `/reset-password` route — including the SPA basename when mounted
 * under a subpath (e.g. `/_console/reset-password`).
 *
 * Resolution order:
 *   1. `<base href="…">` in the document head (matches how Console &
 *      Account derive React Router's basename) — preferred since it
 *      tracks whatever path the host SPA is served from.
 *   2. `'/reset-password'` — sensible default for a SPA at the origin root.
 */
function resolveResetPasswordRedirect(): string {
  try {
    if (typeof document !== 'undefined') {
      const baseEl = document.querySelector('base');
      const href = baseEl?.getAttribute('href');
      if (href) {
        const url = new URL(href, getWindowOrigin() ?? 'http://localhost');
        const path = url.pathname.replace(/\/$/, '');
        return `${path}/reset-password`;
      }
    }
  } catch {
    // ignore — fall through to default
  }
  return '/reset-password';
}

/**
 * Create a fetch wrapper that injects Bearer token from localStorage
 * and captures updated tokens from the `set-auth-token` response header
 * (provided by better-auth's server-side bearer plugin).
 */
function createBearerFetch(baseFetch?: typeof fetch): typeof fetch {
  const fetchImpl = baseFetch || globalThis.fetch.bind(globalThis);
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = TokenStorage.get();
    // Only inject Bearer token for API paths to avoid triggering CORS preflight
    // on public endpoints like /.well-known/objectstack
    if (token) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/\/api\//i.test(url)) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    const response = await fetchImpl(input, { ...init, headers });
    // Capture rotated tokens from the bearer plugin's response header
    const newToken = response.headers.get('set-auth-token');
    if (newToken) {
      TokenStorage.set(newToken);
    }
    return response;
  };
}

/**
 * Create an auth client instance backed by the official better-auth client.
 *
 * Uses Bearer token authentication: tokens are stored in localStorage and
 * sent via `Authorization: Bearer <token>` header on every request. This
 * works across origins (no cookie dependency) and is compatible with mobile
 * clients.
 *
 * Requires the server to have the better-auth `bearer()` plugin enabled.
 *
 * @example
 * ```ts
 * const authClient = createAuthClient({ baseURL: '/api/v1/auth' });
 * const { user, session } = await authClient.signIn({ email, password });
 * ```
 */
export function createAuthClient(config: AuthClientConfig): AuthClient {
  const { baseURL, fetchFn } = config;
  const { origin, basePath } = resolveAuthURL(baseURL);

  const bearerFetch = createBearerFetch(fetchFn);

  const betterAuth = createBetterAuthClient({
    baseURL: origin,
    basePath,
    disableDefaultFetchPlugins: true,
    fetchOptions: { customFetchImpl: bearerFetch },
    plugins: [organizationClient(), twoFactorClient()],
  });

  // The better-auth client exposes methods whose TS return types are narrower
  // than the runtime JSON the server actually sends (e.g. `session` on signIn).
  // We deliberately cast through `unknown` to bridge from better-auth types
  // to the ObjectUI AuthClient contract.

  return {
    async signIn(credentials: SignInCredentials) {
      const { data, error } = await betterAuth.signIn.email({
        email: credentials.email,
        password: credentials.password,
      });
      if (error) {
        throw toAuthError(error);
      }
      const payload = data as unknown as { user: AuthUser; session: AuthSession };
      // Persist token for cross-origin session persistence
      if (payload.session?.token) {
        TokenStorage.set(payload.session.token);
      }
      return { user: payload.user, session: payload.session };
    },

    async signUp(signUpData: SignUpData) {
      const { data, error } = await betterAuth.signUp.email({
        email: signUpData.email,
        password: signUpData.password,
        name: signUpData.name,
      });
      if (error) {
        throw toAuthError(error);
      }
      // better-auth's /sign-up/email returns { token: string | null, user }.
      // - When auto sign-in is enabled and verification is not required, `token`
      //   is the new session token (cookie also set server-side).
      // - When `requireEmailVerification` is on (or `autoSignIn: false`),
      //   `token` is null — no session, no cookie. The user must verify their
      //   email before signing in.
      // Some deployments / older mocks return a `{ user, session }` shape; we
      // accept either to stay compatible.
      const payload = data as unknown as {
        user: AuthUser;
        token?: string | null;
        session?: AuthSession | null;
      };
      const token = payload.token ?? payload.session?.token ?? null;
      if (token) {
        TokenStorage.set(token);
      }
      // Synthesize a session object when the server returned a flat token so
      // existing callers that read `result.session` keep working.
      let session: AuthSession | null = payload.session ?? null;
      if (!session && token) {
        session = { token } as AuthSession;
      }
      return {
        user: payload.user,
        session,
        requiresVerification: token === null,
      };
    },

    async sendVerificationEmail(email: string, callbackURL?: string) {
      // better-auth client exposes this on the root, not under a namespace.
      const baseAuth = betterAuth as unknown as {
        sendVerificationEmail: (args: { email: string; callbackURL?: string }) => Promise<{ error?: { message?: string; status?: number } | null }>;
      };
      const { error } = await baseAuth.sendVerificationEmail({ email, callbackURL });
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    async signOut() {
      const { error } = await betterAuth.signOut();
      TokenStorage.clear();
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    async getSession() {
      // better-fetch RETHROWS transport errors (it does not wrap them in
      // `{ error }`); a network hiccup must read as "signed out for now",
      // not an exception in every AuthProvider boot.
      let data: unknown = null;
      try {
        const res = await betterAuth.getSession();
        if (!res.error) data = res.data;
      } catch { /* transport error — fall through to the retry/null path */ }
      if (data) {
        const payload = data as unknown as { user: AuthUser; session: AuthSession };
        // Keep localStorage in sync if the server returns a fresh token
        if (payload.session?.token) {
          TokenStorage.set(payload.session.token);
        }
        return { user: payload.user, session: payload.session };
      }

      // Stale-bearer self-heal: every request injects the localStorage
      // bearer, and an INVALID bearer shadows a perfectly valid cookie
      // session. SSO landings (e.g. the cloud console's sso-exchange into a
      // tenant environment) only set the cookie — they cannot touch this
      // origin's localStorage — so a leftover token from an earlier login
      // bounces a freshly signed-in user back to the login page forever.
      // Retry once WITHOUT the bearer: a cookie session means the stored
      // token was stale — adopt the live session (and its token) instead.
      if (TokenStorage.get()) {
        try {
          const rawFetch = fetchFn || globalThis.fetch.bind(globalThis);
          const resp = await rawFetch(`${origin}${basePath}/get-session`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (resp.ok) {
            const body = (await resp.json().catch(() => null)) as
              | { user?: AuthUser; session?: AuthSession }
              | null;
            if (body?.user && body?.session) {
              if (body.session.token) TokenStorage.set(body.session.token);
              else TokenStorage.clear();
              return { user: body.user, session: body.session };
            }
            // The server affirmatively says the cookie has no session either
            // — the stored bearer is dead weight; drop it so the next
            // sign-in starts clean. (Transport errors keep the token: they
            // prove nothing about its validity.)
            TokenStorage.clear();
          }
        } catch { /* network hiccup — treat as signed out, keep the token */ }
      }
      return null;
    },

    async forgotPassword(email: string) {
      // better-auth 1.6+ renamed the endpoint from `/forget-password` to
      // `/request-password-reset` (client method `requestPasswordReset`).
      // Older builds only exposed `forgetPassword` → `/forget-password`, which
      // 404s on newer servers. Prefer the current method and fall back to the
      // legacy one so we stay compatible across better-auth versions. Neither
      // method is present in the default client TS types, so cast through
      // unknown.
      //
      // The `redirectTo` here is appended to the email link as
      // `?callbackURL=<redirectTo>`. When the user clicks the email,
      // better-auth verifies the token then 302s to
      // `<redirectTo>?token=…`. We resolve the basename from the
      // `<base href>` tag at runtime so the SPA mounted at e.g.
      // `/_console/` lands on `/_console/reset-password?token=…`.
      type RequestPasswordResetFn = (opts: { email: string; redirectTo: string }) =>
        Promise<{ error: { message?: string; status: number } | null }>;
      const ba = betterAuth as unknown as {
        requestPasswordReset?: RequestPasswordResetFn;
        forgetPassword?: RequestPasswordResetFn;
      };
      const requestReset = ba.requestPasswordReset ?? ba.forgetPassword;
      if (typeof requestReset !== 'function') {
        throw new Error('password reset is not available on this auth backend');
      }
      const { error } = await requestReset({
        email,
        redirectTo: resolveResetPasswordRedirect(),
      });
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    async resetPassword(token: string, newPassword: string) {
      const { error } = await betterAuth.resetPassword({ token, newPassword });
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    async changePassword(currentPassword: string, newPassword: string, options?: { revokeOtherSessions?: boolean }) {
      // better-auth exposes /change-password under the bound client as
      // `changePassword`. The runtime method exists but its TS type is
      // sometimes missing depending on plugin order; cast through unknown.
      type ChangePwFn = (opts: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) =>
        Promise<{ error: { message?: string; status: number } | null }>;
      const fn = (betterAuth as unknown as { changePassword: ChangePwFn }).changePassword;
      if (typeof fn !== 'function') {
        throw new Error('change-password is not available on this auth backend');
      }
      const { error } = await fn({
        currentPassword,
        newPassword,
        ...(options?.revokeOtherSessions != null ? { revokeOtherSessions: options.revokeOtherSessions } : {}),
      });
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    // ADR-0069 — enforced-MFA enrollment. Returns the otpauth:// URI (for a QR)
    // and one-time backup codes. Runtime methods come from the twoFactorClient
    // plugin; cast through unknown to bridge loose better-auth client types.
    async enrollTotp(password: string) {
      type EnableFn = (opts: { password: string }) =>
        Promise<{ data?: { totpURI?: string; backupCodes?: string[] } | null; error?: { message?: string; status?: number } | null }>;
      const tf = (betterAuth as unknown as { twoFactor?: { enable?: EnableFn } }).twoFactor;
      if (!tf || typeof tf.enable !== 'function') {
        throw new Error('two-factor enrollment is not available on this auth backend');
      }
      const { data, error } = await tf.enable({ password });
      if (error) throw new Error(error.message ?? `Two-factor enable failed (${error.status ?? '?'})`);
      return { totpURI: data?.totpURI ?? '', backupCodes: data?.backupCodes ?? [] };
    },

    // ADR-0069 — verify the first TOTP code to activate enrollment.
    async verifyTotp(code: string) {
      type VerifyFn = (opts: { code: string }) =>
        Promise<{ error?: { message?: string; status?: number } | null }>;
      const tf = (betterAuth as unknown as { twoFactor?: { verifyTotp?: VerifyFn } }).twoFactor;
      if (!tf || typeof tf.verifyTotp !== 'function') {
        throw new Error('two-factor verification is not available on this auth backend');
      }
      const { error } = await tf.verifyTotp({ code });
      if (error) throw new Error(error.message ?? `Two-factor verification failed (${error.status ?? '?'})`);
    },

    async setInitialPassword(newPassword: string) {
      // Custom route registered by AuthPlugin (framework). Used by users
      // who came in via SSO and have no credential account yet — server
      // refuses with credential_account_exists (409) if one is already set,
      // pushing the caller to changePassword instead.
      const url = `${origin}${basePath}/set-initial-password`;
      const response = await bearerFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      if (!response.ok) {
        let message = `Set password failed with status ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { message?: string; code?: string } };
          if (body?.error?.message) message = body.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
    },

    async hasLocalPassword() {
      // /list-accounts is provided by better-auth and returns the linked
      // accounts for the authenticated user. We treat the presence of any
      // providerId === 'credential' entry as "has a local password".
      const url = `${origin}${basePath}/list-accounts`;
      try {
        const response = await bearerFetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return false;
        const body = (await response.json()) as Array<{ providerId?: string }> | { data?: Array<{ providerId?: string }> } | null;
        const list = Array.isArray(body) ? body : (body && 'data' in body && Array.isArray((body as any).data) ? (body as any).data : []);
        return (list as Array<{ providerId?: string }>).some((a) => a?.providerId === 'credential');
      } catch {
        return false;
      }
    },

    async updateUser(userData: Partial<AuthUser>) {
      const { data, error } = await betterAuth.updateUser(userData);
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
      if (!data) {
        throw new Error('Update user returned no data');
      }
      // The server response may wrap the user in a `user` key or return it directly
      const raw = data as unknown as Record<string, unknown>;
      return (raw && typeof raw === 'object' && 'user' in raw ? raw.user : raw) as AuthUser;
    },

    async getConfig(): Promise<AuthPublicConfig> {
      const url = `${origin}${basePath}/config`;
      const response = await bearerFetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load auth config (status ${response.status})`);
      }
      const body = (await response.json()) as
        | { success?: boolean; data?: AuthPublicConfig; error?: { message?: string } }
        | AuthPublicConfig;
      // Server wraps the payload as `{ success, data }`; tolerate both shapes.
      if (body && typeof body === 'object' && 'data' in body && body.data) {
        return body.data as AuthPublicConfig;
      }
      return body as AuthPublicConfig;
    },

    async signInWithProvider(providerId: string, options: SignInWithProviderOptions = {}) {
      const { type = 'social', callbackURL, errorCallbackURL } = options;
      // We pass `disableDefaultFetchPlugins: true` to better-auth above,
      // which also disables better-auth's `redirectPlugin` (the one that
      // navigates the browser to `data.url` when the server responds with
      // `{ url, redirect: true }`). The server still returns that payload
      // for OAuth/OIDC providers — we just have to honour it ourselves.
      if (type === 'oidc') {
        const oauth2 = (betterAuth as unknown as {
          signIn: { oauth2?: (args: Record<string, unknown>) => Promise<{ data: { url?: string; redirect?: boolean } | null; error: { message?: string; status: number } | null }> };
        }).signIn.oauth2;
        if (!oauth2) {
          throw new Error('OIDC sign-in is not supported by this auth client build');
        }
        const { data, error } = await oauth2({ providerId, callbackURL, errorCallbackURL });
        if (error) {
          throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
        }
        if (data?.url && typeof window !== 'undefined') {
          window.location.href = data.url;
        }
        return;
      }
      const { data, error } = await betterAuth.signIn.social({
        provider: providerId as Parameters<typeof betterAuth.signIn.social>[0]['provider'],
        callbackURL,
        errorCallbackURL,
      });
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
      const socialUrl = (data as { url?: string; redirect?: boolean } | null)?.url;
      if (socialUrl && typeof window !== 'undefined') {
        window.location.href = socialUrl;
      }
    },

    // --- Organization / Workspace methods ---

    async listOrganizations(): Promise<AuthOrganization[]> {
      const { data, error } = await (betterAuth as any).organization.list();
      if (error) throw new Error(error.message ?? 'Failed to list organizations');
      return (data ?? []) as AuthOrganization[];
    },

    async createOrganization(orgData: { name: string; slug: string; logo?: string }): Promise<AuthOrganization> {
      const { data, error } = await (betterAuth as any).organization.create({
        name: orgData.name,
        slug: orgData.slug,
        logo: orgData.logo,
      });
      if (error) throw new Error(error.message ?? 'Failed to create organization');
      return data as unknown as AuthOrganization;
    },

    async setActiveOrganization(orgId: string): Promise<AuthOrganization | null> {
      const { data, error } = await (betterAuth as any).organization.setActive({
        organizationId: orgId,
      });
      if (error) throw new Error(error.message ?? 'Failed to set active organization');
      return (data ?? null) as AuthOrganization | null;
    },

    async getActiveOrganization(): Promise<AuthOrganization | null> {
      // `/organization/get-full-organization` is the endpoint that returns the
      // active organization record in full. `getActiveMember` returns only the
      // current user's member row (organizationId, role) — not the org itself.
      const { data, error } = await (betterAuth as any).organization.getFullOrganization();
      if (error || !data) return null;
      return data as unknown as AuthOrganization;
    },

    async getActiveMember(): Promise<AuthOrganizationMember | null> {
      // Returns the current user's member row for the active organization
      // (id, organizationId, userId, role). Used to gate UI affordances that
      // require owner/admin role.
      const fn = (betterAuth as any).organization?.getActiveMember;
      if (typeof fn !== 'function') return null;
      const { data, error } = await fn();
      if (error || !data) return null;
      return data as unknown as AuthOrganizationMember;
    },

    async getMembers(orgId: string): Promise<AuthOrganizationMember[]> {
      const { data, error } = await (betterAuth as any).organization.listMembers({
        query: { organizationId: orgId },
      });
      if (error) throw new Error(error.message ?? 'Failed to get members');
      const result = data as unknown as { members?: AuthOrganizationMember[] } | AuthOrganizationMember[];
      if (Array.isArray(result)) return result;
      return (result?.members ?? []) as AuthOrganizationMember[];
    },

    async inviteMember(inviteData: { organizationId: string; email: string; role: string }): Promise<AuthInvitation> {
      const { data, error } = await (betterAuth as any).organization.inviteMember({
        organizationId: inviteData.organizationId,
        email: inviteData.email,
        role: inviteData.role,
      });
      if (error) throw new Error(error.message ?? 'Failed to invite member');
      return data as unknown as AuthInvitation;
    },

    async removeMember(removeData: { organizationId: string; memberIdOrUserId: string }): Promise<void> {
      const { error } = await (betterAuth as any).organization.removeMember({
        organizationId: removeData.organizationId,
        memberIdOrUserId: removeData.memberIdOrUserId,
      });
      if (error) throw new Error(error.message ?? 'Failed to remove member');
    },

    async updateMemberRole(payload: { organizationId: string; memberId: string; role: string }): Promise<void> {
      const { error } = await (betterAuth as any).organization.updateMemberRole({
        organizationId: payload.organizationId,
        memberId: payload.memberId,
        role: payload.role,
      });
      if (error) throw new Error(error.message ?? 'Failed to update member role');
    },

    async updateOrganization(orgId: string, orgData: Partial<Pick<AuthOrganization, 'name' | 'slug' | 'logo' | 'metadata'>>): Promise<AuthOrganization> {
      const { data, error } = await (betterAuth as any).organization.update({
        organizationId: orgId,
        data: orgData,
      });
      if (error) throw new Error(error.message ?? 'Failed to update organization');
      return data as unknown as AuthOrganization;
    },

    async deleteOrganization(orgId: string): Promise<void> {
      const { error } = await (betterAuth as any).organization.delete({
        organizationId: orgId,
      });
      if (error) throw new Error(error.message ?? 'Failed to delete organization');
    },

    async leaveOrganization(orgId: string): Promise<void> {
      const { error } = await (betterAuth as any).organization.leave({
        organizationId: orgId,
      });
      if (error) throw new Error(error.message ?? 'Failed to leave organization');
    },

    // --- Invitation methods ---

    async listInvitations(orgId: string): Promise<AuthInvitation[]> {
      const { data, error } = await (betterAuth as any).organization.listInvitations({
        query: { organizationId: orgId },
      });
      if (error) throw new Error(error.message ?? 'Failed to list invitations');
      return (data ?? []) as AuthInvitation[];
    },

    async cancelInvitation(invitationId: string): Promise<void> {
      const { error } = await (betterAuth as any).organization.cancelInvitation({ invitationId });
      if (error) throw new Error(error.message ?? 'Failed to cancel invitation');
    },

    async getInvitation(invitationId: string): Promise<AuthInvitation> {
      const { data, error } = await (betterAuth as any).organization.getInvitation({
        query: { id: invitationId },
      });
      if (error) throw new Error(error.message ?? 'Failed to load invitation');
      return data as unknown as AuthInvitation;
    },

    async acceptInvitation(invitationId: string): Promise<void> {
      const { error } = await (betterAuth as any).organization.acceptInvitation({ invitationId });
      if (error) throw new Error(error.message ?? 'Failed to accept invitation');
    },

    async rejectInvitation(invitationId: string): Promise<void> {
      const { error } = await (betterAuth as any).organization.rejectInvitation({ invitationId });
      if (error) throw new Error(error.message ?? 'Failed to reject invitation');
    },

    async listUserInvitations(): Promise<AuthInvitation[]> {
      const { data, error } = await (betterAuth as any).organization.listUserInvitations();
      if (error) throw new Error(error.message ?? 'Failed to list invitations');
      return (data ?? []) as AuthInvitation[];
    },
  };
}
