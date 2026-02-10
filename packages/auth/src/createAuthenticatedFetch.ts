/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AuthClient } from './types';

/**
 * Options for creating an authenticated adapter.
 */
export interface AuthenticatedAdapterOptions {
  /** Base URL for the ObjectStack API */
  baseUrl: string;
  /** Auth client to get session tokens from */
  authClient: AuthClient;
  /** Additional adapter options */
  [key: string]: unknown;
}

/**
 * Creates an authenticated fetch wrapper that injects the Bearer token
 * from the auth session into every request to the ObjectStack API.
 *
 * This is the recommended way to integrate authentication with
 * @objectstack/client's ObjectStackAdapter.
 *
 * @example
 * ```ts
 * import { ObjectStackAdapter } from '@object-ui/data-objectstack';
 * import { createAuthClient, createAuthenticatedFetch } from '@object-ui/auth';
 *
 * const authClient = createAuthClient({ baseURL: '/api/auth' });
 * const authenticatedFetch = createAuthenticatedFetch(authClient);
 *
 * const adapter = new ObjectStackAdapter({
 *   baseUrl: '/api/v1',
 *   fetch: authenticatedFetch,
 * });
 * ```
 */
export function createAuthenticatedFetch(
  authClient: AuthClient,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const session = await authClient.getSession();
    const headers = new Headers(init?.headers);
    if (session?.session?.token) {
      headers.set('Authorization', `Bearer ${session.session.token}`);
    }
    return fetch(input, { ...init, headers });
  };
}
