/**
 * Thin REST client for `/api/settings`. Matches the surface mounted by
 * `@objectstack/service-settings`.
 */

import type {
  SettingsActionResult,
  SettingsListResponse,
  SettingsNamespacePayload,
} from './types';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const BASE = `${SERVER_URL}/api/settings`;

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const err = new Error(detail?.error?.message ?? res.statusText) as Error & { status?: number; payload?: any };
    err.status = res.status;
    err.payload = detail;
    throw err;
  }
  return res.json() as Promise<T>;
}

const jsonHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/**
 * The env-locked key named by a `SETTINGS_LOCKED` error, read from whichever
 * position the serving version puts it in (objectstack#4224).
 *
 * It used to arrive as `error.key` — a SIBLING of `code`/`message` that
 * `ApiErrorSchema` never declared. That body was accepted only because the
 * schema is a plain `z.object` and strips undeclared keys rather than rejecting
 * them, so nothing on either side ever flagged it. objectstack#4224 moves it to
 * `error.details.key`, the slot the contract does declare.
 *
 * Declared home first, old position second, so the console names the key against
 * servers on either side of that change instead of rendering `undefined` for the
 * duration of the window. Drop the second read once the oldest supported server
 * carries the fix.
 *
 * Lives here rather than inline in the view because this module already owns
 * what the server's error body looks like (`jsonOrThrow` is what builds
 * `err.payload`), and because a compat shim that no test exercises is a compat
 * shim that gets deleted by the next person who reads only one of the two
 * shapes.
 */
export function lockedKeyOf(apiError: unknown): string | undefined {
  if (!apiError || typeof apiError !== 'object') return undefined;
  const e = apiError as { key?: unknown; details?: { key?: unknown } | null };
  const declared = e.details && typeof e.details === 'object' ? e.details.key : undefined;
  const found = declared ?? e.key;
  return typeof found === 'string' && found.length > 0 ? found : undefined;
}

export async function listSettingsManifests(): Promise<SettingsListResponse> {
  const res = await fetch(BASE, { credentials: 'include', headers: jsonHeaders() });
  return jsonOrThrow<SettingsListResponse>(res);
}

export async function getSettingsNamespace(namespace: string): Promise<SettingsNamespacePayload> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}`, {
    credentials: 'include',
    headers: jsonHeaders(),
  });
  return jsonOrThrow<SettingsNamespacePayload>(res);
}

export async function saveSettingsNamespace(
  namespace: string,
  patch: Record<string, unknown>,
): Promise<{ values: SettingsNamespacePayload['values'] }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  });
  return jsonOrThrow<{ values: SettingsNamespacePayload['values'] }>(res);
}

export async function runSettingsAction(
  namespace: string,
  actionId: string,
  payload?: unknown,
): Promise<SettingsActionResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}/${encodeURIComponent(actionId)}`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(),
    body: JSON.stringify(payload ?? {}),
  });
  // The action endpoint always returns SettingsActionResult JSON, even on 400.
  const data = (await res.json().catch(() => ({ ok: false, message: res.statusText }))) as SettingsActionResult;
  if (typeof data?.ok !== 'boolean') {
    return { ok: res.ok, message: (data as any)?.error?.message ?? res.statusText };
  }
  return data;
}
