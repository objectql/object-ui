/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
    [k: string]: unknown;
  }>;
  /** field-level perms keyed `"object.field"` */
  fields: Record<string, { readable?: boolean; editable?: boolean }>;
}

export interface MePermissionsProviderProps {
  /** Absolute or relative URL to the /me/permissions endpoint */
  endpoint?: string;
  /** Pre-fetched permissions payload (testing / SSR) */
  initialPermissions?: MePermissionsResponse;
  /** Rendered while permissions load (fail-closed) */
  loadingFallback?: React.ReactNode;
  /** Rendered when load fails */
  errorFallback?: (err: Error, retry: () => void) => React.ReactNode;
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
  initialPermissions,
  loadingFallback = null,
  errorFallback,
  children,
}: MePermissionsProviderProps) {
  const [data, setData] = useState<MePermissionsResponse | null>(initialPermissions ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!initialPermissions);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Permissions endpoint returned ${res.status}`);
      const json = (await res.json()) as MePermissionsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (initialPermissions) return;
    void fetchPermissions();
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
      if (!objPerm) return true; // permissive default when nothing configured
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
      };
      const k = map[action as string] ?? 'allowRead';
      const allowed = objPerm ? (objPerm as any)[k] !== false : true;
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

  const value = useMemo<PermissionContextValue>(
    () => ({
      check,
      checkField,
      getFieldPermissions,
      getRowFilter,
      roles: data?.roles ?? [],
      systemPermissions: data?.systemPermissions ?? [],
      hasCapabilities: (required: string[]) => {
        const held = new Set(data?.systemPermissions ?? []);
        return required.every((p) => held.has(p));
      },
      isLoaded: !loading && !error && data !== null,
    }),
    [check, checkField, getFieldPermissions, getRowFilter, data, loading, error],
  );

  if (loading && !data) return <>{loadingFallback}</>;
  if (error && !data) {
    if (errorFallback) return <>{errorFallback(error, fetchPermissions)}</>;
    return <>{loadingFallback}</>;
  }

  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}
