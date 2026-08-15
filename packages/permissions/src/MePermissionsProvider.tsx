/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  HttpFetchError,
  backoffMs,
  isTransientFailure,
  retryAfterFrom,
  sleep,
} from '@object-ui/types';
import type {
  PermissionAction,
  PermissionCheckResult,
  FieldLevelPermission,
} from '@object-ui/types';
import { PermCtx, type PermissionContextValue } from './PermissionContext';

/**
 * Shape of the upstream `/api/v1/auth/me/permissions` response.
 * See framework/packages/plugins/plugin-hono-server.
 */
export interface MePermissionsResponse {
  authenticated: boolean;
  userId: string | null;
  tenantId: string | null;
  roles: string[];
  permissionSets: string[];
  /** [ADR-0066] System capabilities (union of permission-set systemPermissions): manage_users, setup.access, … */
  systemPermissions?: string[];
  /** object-level perms: { "*": {...}, "account": {...} } */
  objects: Record<string, {
    allowCreate?: boolean;
    allowRead?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    viewAllRecords?: boolean;
    modifyAllRecords?: boolean;
    /**
     * [#3391] Server-resolved effective API operation set for this object
     * (enum-ordered). Present only when the object tightens exposure via
     * `apiMethods`; absent = unrestricted (client default-allow). The frontend
     * consumes THIS, never a raw `apiMethods` whitelist.
     */
    apiOperations?: string[];
    [k: string]: unknown;
  }>;
  /** field-level perms keyed `"object.field"` */
  fields: Record<string, { readable?: boolean; editable?: boolean }>;
}

export interface MePermissionsProviderProps {
  /** Absolute or relative URL to the /me/permissions endpoint */
  endpoint?: string;
  /**
   * Fetch implementation used to call the endpoint. Pass an authenticated
   * fetch (e.g. `createAuthenticatedFetch()` from `@object-ui/auth`) so the
   * request carries the Bearer token: with the default global `fetch` the
   * request is cookie-only, and a token-only session (localStorage, no
   * better-auth cookie) resolves as anonymous — the UI then renders
   * restricted fields as editable (#2926 ④).
   */
  fetcher?: typeof fetch;
  /** Pre-fetched permissions payload (testing / SSR) */
  initialPermissions?: MePermissionsResponse;
  /** Rendered while permissions load (fail-closed) */
  loadingFallback?: React.ReactNode;
  /** Rendered when load fails */
  errorFallback?: (err: Error, retry: () => void) => React.ReactNode;
  /**
   * How many times to re-attempt a TRANSIENT failure before giving up — a
   * response that says "not now" (`TRANSIENT_STATUS` in `@object-ui/types`) or a network
   * error. `0` disables retrying.
   *
   * This exists because "not now" is a real answer from this endpoint. On a
   * multi-tenant host it is served by the environment kernel that owns the
   * session, and a cold one answers `503` + `Retry-After` while it warms
   * (objectstack#4159). Without a retry the provider keeps `loadingFallback`
   * on screen forever, because a consumer that passes no `errorFallback` — the
   * console does exactly that — renders the loading node for the error state
   * too, and nothing ever calls `retry`.
   *
   * @default 3
   */
  maxRetries?: number;
  /**
   * Base for the exponential backoff between retries, in ms. A `Retry-After`
   * header on the response wins over it. @default 500
   */
  retryBaseDelayMs?: number;
  /** Children */
  children: React.ReactNode;
}

const DEFAULT_ENDPOINT = '/api/v1/auth/me/permissions';

/**
 * MePermissionsProvider
 *
 * Fetches the current user's effective permissions from the framework's
 * `/me/permissions` endpoint and exposes them through the shared
 * `PermCtx` so that all existing `usePermissions` / `useFieldPermissions`
 * consumers transparently get server-driven field-level gating.
 *
 * Fail-closed: while loading, renders `loadingFallback` (default: null)
 * so consumers never see "permitted" state before the data arrives.
 */
export function MePermissionsProvider({
  endpoint = DEFAULT_ENDPOINT,
  fetcher,
  initialPermissions,
  loadingFallback = null,
  errorFallback,
  maxRetries = 3,
  retryBaseDelayMs = 500,
  children,
}: MePermissionsProviderProps) {
  const [data, setData] = useState<MePermissionsResponse | null>(initialPermissions ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!initialPermissions);

  /**
   * Run the fetch, re-attempting a transient failure.
   *
   * `token` cancels an in-flight attempt. Retries put real time (a backoff, or
   * a server-stated `Retry-After`) between the request and the `setState`, and
   * during that window the effect may be torn down — by an unmount, or by
   * `endpoint`/`fetcher` changing. Without the token a superseded attempt would
   * still land, so a slow answer for the OLD endpoint could overwrite a fast
   * answer for the new one.
   */
  const fetchPermissions = useCallback(
    async (token?: { cancelled: boolean }) => {
      const live = () => !token?.cancelled;
      setLoading(true);
      setError(null);
      const doFetch = fetcher ?? fetch;
      const attempts = Math.max(0, maxRetries) + 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const res = await doFetch(endpoint, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            throw new HttpFetchError(
              res.status,
              retryAfterFrom(res),
              `Permissions endpoint returned ${res.status}`,
            );
          }
          const json = (await res.json()) as MePermissionsResponse;
          if (!live()) return;
          setData(json);
          setLoading(false);
          return;
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          if (!isTransientFailure(err) || attempt === attempts - 1) {
            if (!live()) return;
            setError(err);
            setLoading(false);
            return;
          }
          // `loading` stays true across the wait, so the fail-closed loading
          // state holds and the recovery is invisible to consumers.
          const stated = err instanceof HttpFetchError ? err.retryAfterMs : undefined;
          await sleep(backoffMs(attempt, retryBaseDelayMs, stated));
          if (!live()) return;
        }
      }
    },
    [endpoint, fetcher, maxRetries, retryBaseDelayMs],
  );

  /** The `retry` handed to `errorFallback` — uncancelled, it is user-initiated. */
  const retry = useCallback(() => { void fetchPermissions(); }, [fetchPermissions]);

  useEffect(() => {
    if (initialPermissions) return;
    const token = { cancelled: false };
    void fetchPermissions(token);
    return () => { token.cancelled = true; };
  }, [fetchPermissions, initialPermissions]);

  const checkField = useCallback(
    (object: string, field: string, action: 'read' | 'write'): boolean => {
      if (!data) return false; // fail-closed
      // Normalize casing — backend stores keys lowercase but callers may
      // pass schema.objectName as "Account" / "account" interchangeably.
      const objKey = (object ?? '').toLowerCase();
      const key = `${objKey}.${field}`;
      const fieldPerm = data.fields?.[key] ?? data.fields?.[`${object}.${field}`];
      if (fieldPerm) {
        return action === 'read'
          ? fieldPerm.readable !== false
          : fieldPerm.editable !== false;
      }
      // No explicit field-level override → defer to object-level perms.
      const objPerm = data.objects?.[objKey] ?? data.objects?.[object] ?? data.objects?.['*'];
      if (!objPerm) {
        // [#2926 ④] Unknown-object default is authentication-gated:
        //  - authenticated session → fail-CLOSED. The server resolved this
        //    user's permissions and said nothing about the object, so
        //    rendering it editable invites input the data layer will strip.
        //  - anonymous (`authenticated: false` — the endpoint's no-session
        //    200 carries no objects/fields at all) → keep the permissive
        //    default. Guest/public surfaces have no resolvable perms by
        //    design; the server still enforces, and locking every field
        //    would brick public forms.
        return data.authenticated !== true;
      }
      return action === 'read'
        ? objPerm.allowRead !== false
        : objPerm.allowEdit !== false;
    },
    [data],
  );

  const check = useCallback(
    (object: string, action: PermissionAction): PermissionCheckResult => {
      if (!data) return { allowed: false, reason: 'permissions-loading' };
      const objPerm = data.objects?.[object] ?? data.objects?.['*'];
      const map: Record<string, keyof NonNullable<typeof objPerm>> = {
        read: 'allowRead',
        view: 'allowRead',
        create: 'allowCreate',
        update: 'allowEdit',
        edit: 'allowEdit',
        delete: 'allowDelete',
        // [#3391] import derives from create∨update, export from list(read) —
        // gate them on the base write/read permission bit (the per-object
        // effective API operation set adds the finer apiMethods layer on top,
        // consumed via getObjectApiOperations + resolveCrudAffordances).
        import: 'allowCreate',
        export: 'allowRead',
      };
      const k = map[action as string] ?? 'allowRead';
      // Same authentication-gated default as checkField (#2926 ④).
      const allowed = objPerm ? (objPerm as any)[k] !== false : data.authenticated !== true;
      return { allowed, reason: allowed ? undefined : 'denied-by-permission-set' };
    },
    [data],
  );

  const getFieldPermissions = useCallback(
    (object: string): FieldLevelPermission[] => {
      if (!data) return [];
      const prefix = `${object}.`;
      const out: FieldLevelPermission[] = [];
      for (const [key, value] of Object.entries(data.fields ?? {})) {
        if (!key.startsWith(prefix)) continue;
        const field = key.slice(prefix.length);
        out.push({
          field,
          read: value.readable !== false,
          write: value.editable !== false,
        });
      }
      return out;
    },
    [data],
  );

  const getRowFilter = useCallback(() => undefined, []);

  const getObjectApiOperations = useCallback(
    (object: string): string[] | undefined => {
      if (!data) return undefined;
      const objKey = (object ?? '').toLowerCase();
      // Per-object only — the `*` wildcard carries no apiOperations. Absent →
      // undefined so consumers fall back to their current (default-allow) path.
      const objPerm = data.objects?.[objKey] ?? data.objects?.[object];
      const ops = objPerm?.apiOperations;
      return Array.isArray(ops) ? ops : undefined;
    },
    [data],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      check,
      checkField,
      getFieldPermissions,
      getRowFilter,
      getObjectApiOperations,
      roles: data?.roles ?? [],
      // [objectui#4656] Forward the raw signal — do NOT `?? []` this. A
      // backend predating ADR-0066 omits `systemPermissions` from the
      // response entirely, and defaulting that to `[]` here made it
      // indistinguishable from a genuinely empty grant to every consumer
      // downstream (this provider's own `hasCapabilities` included).
      systemPermissions: data?.systemPermissions,
      hasCapabilities: (required: string[]) => {
        const perms = data?.systemPermissions;
        // Unknown (backend never reported systemPermissions) fails OPEN — see
        // the doctrine on `PermissionContextValue.hasCapabilities`.
        if (!Array.isArray(perms)) return true;
        const held = new Set(perms);
        return required.every((p) => held.has(p));
      },
      isLoaded: !loading && !error && data !== null,
    }),
    [check, checkField, getFieldPermissions, getRowFilter, getObjectApiOperations, data, loading, error],
  );

  if (loading && !data) return <>{loadingFallback}</>;
  if (error && !data) {
    if (errorFallback) return <>{errorFallback(error, retry)}</>;
    return <>{loadingFallback}</>;
  }

  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}
