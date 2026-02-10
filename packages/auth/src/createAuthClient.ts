/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AuthClient, AuthClientConfig, AuthUser, AuthSession, SignInCredentials, SignUpData } from './types';

/**
 * Create an auth client instance.
 *
 * This factory creates an abstraction layer over the authentication provider.
 * It is designed to work with better-auth but can be adapted to any auth backend
 * that exposes standard REST endpoints for sign-in, sign-up, sign-out, and session management.
 *
 * @example
 * ```ts
 * const authClient = createAuthClient({ baseURL: '/api/auth' });
 * const { user, session } = await authClient.signIn({ email, password });
 * ```
 */
export function createAuthClient(config: AuthClientConfig): AuthClient {
  const { baseURL, fetchFn = fetch } = config;

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${baseURL}${path}`;
    const response = await fetchFn(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = (body && typeof body === 'object' && 'message' in body)
        ? String(body.message)
        : `Auth request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  return {
    async signIn(credentials: SignInCredentials) {
      return request<{ user: AuthUser; session: AuthSession }>('/sign-in/email', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },

    async signUp(data: SignUpData) {
      return request<{ user: AuthUser; session: AuthSession }>('/sign-up/email', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async signOut() {
      await request('/sign-out', { method: 'POST' });
    },

    async getSession() {
      try {
        return await request<{ user: AuthUser; session: AuthSession }>('/get-session', {
          method: 'GET',
        });
      } catch {
        return null;
      }
    },

    async forgotPassword(email: string) {
      await request('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword(token: string, newPassword: string) {
      await request('/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
    },

    async updateUser(data: Partial<AuthUser>) {
      const result = await request<{ user: AuthUser }>('/update-user', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result.user;
    },
  };
}
