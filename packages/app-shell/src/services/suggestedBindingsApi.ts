// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Suggested audience bindings (ADR-0090 D5/D9) — client for the framework's
 * `/api/v1/security/suggested-bindings` surface.
 *
 * A package permission set declaring `isDefault: true` is an install-time
 * SUGGESTION to bind the set to the built-in `everyone` position (default
 * grants for authenticated users). The server never auto-binds: a tenant
 * admin confirms or dismisses each suggestion. These calls are ordinary
 * same-origin admin API calls (not object CRUD), so they follow the
 * marketplaceApi raw-fetch pattern: Bearer token + `credentials: 'include'`.
 */

import { TokenStorage } from '@object-ui/auth';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1/security/suggested-bindings`;

export interface SuggestedBinding {
  id: string;
  package_id: string;
  permission_set_name: string;
  anchor: 'everyone' | 'guest';
  status: 'pending' | 'confirmed' | 'dismissed';
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extra };
  const token = TokenStorage.get();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function parseOrThrow(res: Response): Promise<any> {
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const code = payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? payload?.error ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : String(code));
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return payload?.data ?? payload;
}

/**
 * List suggestions. The server reconciles first (installed manifests →
 * pending rows), so calling this right after an install already sees the
 * new package's suggestions. Requires a tenant-level admin; non-admin
 * callers get a 403 the UI should treat as "surface hidden".
 */
export async function listSuggestedBindings(filter: {
  status?: 'pending' | 'confirmed' | 'dismissed';
  packageId?: string;
} = {}): Promise<SuggestedBinding[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.packageId) params.set('packageId', filter.packageId);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  const data = await parseOrThrow(res);
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

/**
 * Confirm a pending suggestion — the server creates the anchor binding under
 * the ADR-0090 gates (a high-privilege set is refused with a 403 whose
 * message explains the offending bits; surface it verbatim).
 */
export async function confirmSuggestedBinding(id: string): Promise<SuggestedBinding> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseOrThrow(res);
  return data?.suggestion as SuggestedBinding;
}

/** Dismiss a pending suggestion (the set stays bindable by hand later). */
export async function dismissSuggestedBinding(id: string): Promise<SuggestedBinding> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await parseOrThrow(res);
  return data?.suggestion as SuggestedBinding;
}
