/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createAuthClient as createBetterAuthClient } from 'better-auth/client';
import type { AuthClient, AuthClientConfig, AuthUser, AuthSession, SignInCredentials, SignUpData } from './types';

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
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
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
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
      const payload = data as unknown as { user: AuthUser; session: AuthSession };
      if (payload.session?.token) {
        TokenStorage.set(payload.session.token);
      }
      return { user: payload.user, session: payload.session };
    },

    async signOut() {
      const { error } = await betterAuth.signOut();
      TokenStorage.clear();
      if (error) {
        throw new Error(error.message ?? `Auth request failed with status ${error.status}`);
      }
    },

    async getSession() {
      const { data, error } = await betterAuth.getSession();
      if (error || !data) return null;
      const payload = data as unknown as { user: AuthUser; session: AuthSession };
      // Keep localStorage in sync if the server returns a fresh token
      if (payload.session?.token) {
        TokenStorage.set(payload.session.token);
      }
      return { user: payload.user, session: payload.session };
    },

    async forgotPassword(email: string) {
      // better-auth uses "forgetPassword" (without the "o"); the method
      // exists at runtime but is not present in the default TS types.
      type ForgetPasswordFn = (opts: { email: string; redirectTo: string }) =>
        Promise<{ error: { message?: string; status: number } | null }>;
      const forgetPw = (betterAuth as unknown as { forgetPassword: ForgetPasswordFn }).forgetPassword;
      const { error } = await forgetPw({ email, redirectTo: '/' });
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
  };
}
