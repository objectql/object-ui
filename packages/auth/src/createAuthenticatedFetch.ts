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

const ACTIVE_ORG_STORAGE_KEY = 'auth-active-organization-id';

/**
 * Control-plane objects whose Cloud Admin (`cloud_control`) list views may read
 * across organizations for a platform super-admin. The server-side org-scope
 * hook recognizes AND strips the `platformScope=all` signal for EXACTLY these
 * objects, so we only ever attach it to their requests — never to any other
 * object, whose query the unrecognized param would otherwise corrupt.
 */
const CROSS_ORG_OBJECTS_RE =
  /\/api\/v1\/data\/(sys_environment_member|sys_environment|sys_app|sys_team|sys_invitation|sys_organization)(?:[/?#]|$)/i;

/**
 * True when the platform Cloud Admin app (`cloud_control`) is the active app —
 * the only app allowed to request cross-org scope. Read from the route
 * (`/apps/cloud_control/…`, basename-agnostic) so this non-React middleware
 * needs no context wiring; fails closed off the browser.
 */
function isCloudControlAppActive(): boolean {
  try {
    return typeof window !== 'undefined'
      && /\/apps\/cloud_control(?:[/?#]|$)/.test(window.location.pathname);
  } catch {
    return false;
  }
}

/**
 * Get/set the active organization ID for tenant-scoped API requests.
 * Used by createAuthenticatedFetch to inject X-Tenant-ID header.
 */
export const ActiveOrganizationStorage = {
  _memoryValue: null as string | null,

  get(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
      }
    } catch { /* SSR / test */ }
    return this._memoryValue;
  },

  set(orgId: string): void {
    this._memoryValue = orgId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
      }
    } catch { /* SSR / test */ }
  },

  clear(): void {
    this._memoryValue = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
      }
    } catch { /* SSR / test */ }
  },
};

/**
 * Creates an authenticated fetch wrapper that injects the Bearer token
 * from localStorage into every request to the ObjectStack API.
 * Also injects X-Tenant-ID header when an active organization is set.
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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApiCall = /\/api\//i.test(url);
    const token = TokenStorage.get();
    if (token && isApiCall) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // Inject tenant header for multi-tenant routing
    const activeOrgId = ActiveOrganizationStorage.get();
    if (activeOrgId) {
      headers.set('X-Tenant-ID', activeOrgId);
    }
    // Inject the active UI language so the server resolves metadata labels
    // (object/field/view labels, action-dialog text) in the right locale. The
    // i18n provider keeps `<html lang>` in sync with the in-app language
    // switcher, so reading it here means a language switch carries the new
    // `Accept-Language` on every subsequent request — closing the gap where
    // server-resolved labels stayed in the old language until a page refresh
    // (issue #1319). We only fold it in for our own API calls, and never
    // clobber an `Accept-Language` the caller set explicitly.
    if (isApiCall && !headers.has('Accept-Language') && typeof document !== 'undefined') {
      const lang = document.documentElement.lang;
      if (lang) {
        headers.set('Accept-Language', lang);
      }
    }
    // Cloud Admin (cloud_control) cross-org reads: a platform super-admin
    // browsing the Cloud Admin should see every org's environments / teams /
    // apps / invitations, not just their own. Signal the server with
    // `?platformScope=all`, scoped to (a) the cloud_control app and (b) the
    // control-plane objects the server recognizes + strips — so it can never
    // alter another app's or object's query. The server HONORS it only for a
    // VERIFIED super-admin (and audits it); for anyone else it is ignored and
    // stripped, so attaching it is always safe.
    if (
      isApiCall
      && (typeof input === 'string' || input instanceof URL)
      && CROSS_ORG_OBJECTS_RE.test(url)
      && !/[?&]platformScope=/.test(url)
      && isCloudControlAppActive()
    ) {
      const sep = url.includes('?') ? '&' : '?';
      return fetch(`${url}${sep}platformScope=all`, { ...init, headers });
    }
    return fetch(input, { ...init, headers });
  };
}
