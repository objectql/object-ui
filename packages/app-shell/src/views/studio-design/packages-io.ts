// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package-list helpers shared by the Studio package switcher and the builder
 * landing page.
 *
 * Writability is a DISPLAY heuristic — kernel packages (scope system/cloud)
 * are hidden, `scope: 'project'` marks a read-only code package (authoring is
 * refused server-side by the ADR-0070 D4 gate), and a scope-less entry is a
 * database base package (writable). The gate stays the authority; this only
 * sets expectations up front.
 */

export interface PkgEntry {
  id: string;
  name: string;
  writable: boolean;
}

export function parsePackages(payload: unknown): PkgEntry[] {
  const root = (payload as { data?: unknown })?.data ?? payload;
  const raw = Array.isArray(root) ? root : ((root as { packages?: unknown[] })?.packages ?? []);
  const out: PkgEntry[] = [];
  for (const p of raw as Array<Record<string, unknown>>) {
    if (!p || typeof p !== 'object') continue;
    const m = (p.manifest ?? {}) as Record<string, unknown>;
    const id = String(m.id ?? p.id ?? '');
    if (!id) continue;
    const scope = typeof m.scope === 'string' ? m.scope : '';
    if (scope === 'system' || scope === 'cloud') continue; // kernel — not app packages
    out.push({ id, name: String(m.name ?? id), writable: scope !== 'project' });
  }
  return out;
}

export async function fetchPackages(): Promise<PkgEntry[]> {
  const res = await fetch('/api/v1/packages', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parsePackages(await res.json());
}

/** Create a writable base package (POST /packages {id, name}). */
export async function createBasePackage(id: string, name: string): Promise<void> {
  const res = await fetch('/api/v1/packages', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id, name }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { success?: boolean; error?: { message?: string } }
    | null;
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || `HTTP ${res.status}`);
  }
}

export const PACKAGE_ID_RE = /^[a-z][a-z0-9_.-]*(\.[a-z0-9_-]+)+$/;
