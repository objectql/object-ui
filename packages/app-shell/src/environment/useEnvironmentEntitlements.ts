/**
 * useEnvironmentEntitlements — resolve the org's environment-capacity state so
 * the `sys_environment` list can present the right "create" affordance up front.
 *
 * Two signals, in priority order:
 *   1. AUTHORITATIVE — GET /cloud/environment-entitlements (org-scoped, computed
 *      by the same helper the create guard uses). Gives plan + dev-create
 *      capability precisely, including the seat-scaled / subscription cases the
 *      client can't derive from rows.
 *   2. FALLBACK — when that endpoint is unavailable (older control plane / error,
 *      or a success body that doesn't carry the `{ success, data }` envelope),
 *      derive `hasProductionEnv` from the org's env rows via the data API (which
 *      is org-scoped on the control plane). This keeps the critical
 *      "set up your production environment" path working without a backend deploy;
 *      free-vs-paid is left unknown, and a stray create POST is caught by the
 *      entitlement dialog safety net.
 *
 * Returns `null` when disabled (not the environment list) so callers can cheaply
 * branch. Re-resolves when `refreshKey` changes (e.g. after a create).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@object-ui/auth';
import {
  DEFAULT_UPGRADE_URL,
  type EnvironmentEntitlementsState,
  type EnvironmentEntitlementsSummary,
} from './entitlements.js';

const TERMINAL_STATUSES = new Set(['archived', 'failed']);

/** Mirror of the server `classifyEnvironmentType`: explicit type, else default→prod. */
function classifyEnvironmentType(row: any): 'production' | 'development' {
  const t = String(row?.environment_type ?? '').trim().toLowerCase();
  if (t === 'production' || t === 'prod') return 'production';
  if (t) return 'development';
  return row?.is_default === true || row?.is_default === 1 ? 'production' : 'development';
}

export interface UseEnvironmentEntitlementsOptions {
  /** Only fetch when this is the environment list (objectName === 'sys_environment'). */
  enabled: boolean;
  dataSource: any;
  /** Authenticated fetch (Bearer + tenant + cookies) — from the action runtime. */
  authFetch: (url: string, init?: any) => Promise<Response>;
  /** Control-plane origin (VITE_SERVER_URL); '' in same-origin production. */
  apiBase: string;
  /** Bump to re-resolve (e.g. the list's refreshKey after a successful create). */
  refreshKey?: unknown;
}

export function useEnvironmentEntitlements(
  opts: UseEnvironmentEntitlementsOptions,
): EnvironmentEntitlementsState | null {
  const { enabled, dataSource, authFetch, apiBase, refreshKey } = opts;
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id;
  const [state, setState] = useState<EnvironmentEntitlementsState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    let cancelled = false;

    const fromSummary = async (): Promise<EnvironmentEntitlementsState | null> => {
      try {
        const base = (apiBase || '').replace(/\/+$/, '');
        const qs = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
        const res = await authFetch(`${base}/api/v1/cloud/environment-entitlements${qs}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) return null;
        // Strict envelope read: the control plane wraps every success body as
        // `{ success, data }` (cloud#1046), and `EnvironmentEntitlementsSummary`
        // is declared as that `data` payload. A bare body is therefore a
        // producer contract violation, not a second accepted dialect — reading
        // it would yield a summary whose fields are all `undefined`, i.e. a
        // silent `hasProductionEnv: false`. Returning null instead degrades to
        // the `fromRows()` derivation, which resolves that signal for real.
        const json = (await res.json().catch(() => null)) as
          | { data?: EnvironmentEntitlementsSummary }
          | null;
        const data = json?.data;
        if (!data || typeof data !== 'object') return null;
        return {
          ready: true,
          hasProductionEnv: data.hasProductionEnv === true,
          canCreateDevelopmentEnv: data.development?.canCreate,
          plan: data.plan,
          upgradeUrl: data.upgradeUrl || DEFAULT_UPGRADE_URL,
          contactSalesUrl: data.contactSalesUrl,
          source: 'summary',
        };
      } catch {
        return null;
      }
    };

    const fromRows = async (): Promise<EnvironmentEntitlementsState> => {
      try {
        const params: any = { $top: 200 };
        if (orgId) params.$filter = { organization_id: orgId };
        const res = await dataSource.find('sys_environment', params);
        const rows: any[] = Array.isArray(res) ? res : res?.data ?? [];
        const active = rows.filter((r) => !TERMINAL_STATUSES.has(String(r?.status ?? '')));
        const hasProductionEnv = active.some((r) => classifyEnvironmentType(r) === 'production');
        return {
          ready: true,
          hasProductionEnv,
          canCreateDevelopmentEnv: undefined,
          upgradeUrl: DEFAULT_UPGRADE_URL,
          source: 'derived',
        };
      } catch {
        return {
          ready: false,
          hasProductionEnv: false,
          canCreateDevelopmentEnv: undefined,
          upgradeUrl: DEFAULT_UPGRADE_URL,
          source: 'unknown',
        };
      }
    };

    (async () => {
      const summary = await fromSummary();
      const next = summary ?? (await fromRows());
      if (!cancelled) setState(next);
    })();

    return () => { cancelled = true; };
  }, [enabled, orgId, apiBase, authFetch, dataSource, refreshKey]);

  return state;
}
