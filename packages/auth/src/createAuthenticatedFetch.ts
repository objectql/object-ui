/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TokenStorage } from './createAuthClient';

/**
 * Options for creating an authenticated adapter.
 */
export interface AuthenticatedAdapterOptions {
  /** Base URL for the ObjectStack API */
  baseUrl: string;
  /** Additional adapter options */
  [key: string]: unknown;
}

/**
 * Creates an authenticated fetch wrapper that injects the Bearer token
 * from localStorage into every request to the ObjectStack API.
 *
 * Reads the token directly from TokenStorage (localStorage) — no extra
 * HTTP round-trip needed.
 *
 * @example
 * ```ts
 * import { ObjectStackAdapter } from '@object-ui/data-objectstack';
 * import { createAuthenticatedFetch } from '@object-ui/auth';
 *
 * const authenticatedFetch = createAuthenticatedFetch();
 *
 * const adapter = new ObjectStackAdapter({
 *   baseUrl: '/api/v1',
 *   fetch: authenticatedFetch,
 * });
 * ```
 */
export function createAuthenticatedFetch(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const token = TokenStorage.get();
    if (token) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/\/api\//i.test(url)) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return fetch(input, { ...init, headers });
  };
}
