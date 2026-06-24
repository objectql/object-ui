// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { detectLocale, t } from './i18n';

/**
 * Sentinel "package" id for this environment's runtime, DB-authored metadata —
 * items with no code-package binding (`package_id IS NULL`). The metadata
 * list/get API treats `?package=sys_metadata` as exactly that local scope on
 * READ, and a WRITE under it persists `package_id = null` (matching the
 * server's runtime-only provenance, see framework #2252).
 *
 * Why this exists: a self-hosted, metadata-customizable environment is
 * single-tenant — there is no "org" dimension here; the real axis is
 * code-package vs. runtime (DB-authored). Before this scope, the package
 * selector only listed code packages, so metadata authored at runtime
 * (`package_id = null`) was filtered out of every code-package view and became
 * un-navigable (the route redirected to "new"). Surfacing the local scope as a
 * first-class, always-present selector entry makes it discoverable and editable.
 */
export const LOCAL_PACKAGE_ID = 'sys_metadata';

const SYSTEM_SCOPES = new Set(['system', 'cloud']);

/**
 * Build the Studio package-scope options from the raw `package` metadata list.
 * Filters out system/cloud-scoped packages and appends a stable
 * "Local / Custom (this environment)" scope so runtime metadata authored here
 * is always selectable/visible — even when zero items exist yet.
 */
export function buildPackageScopeOptions(
  rawList: unknown[] | null | undefined,
): { id: string; name: string }[] {
  const rows = (rawList ?? [])
    .map((raw) => {
      const item =
        raw && typeof raw === 'object' && 'item' in raw ? (raw as { item: unknown }).item : raw;
      const m = ((item as { manifest?: unknown } | null)?.manifest ?? item ?? {}) as Record<
        string,
        unknown
      >;
      return {
        id: m.id as string,
        scope: m.scope as string,
        name: (m.name as string) || (m.id as string),
      };
    })
    .filter((p) => p.id && !SYSTEM_SCOPES.has(p.scope));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const opts = rows.map((p) => ({ id: p.id, name: p.name }));
  // Append (never default) so the existing first-code-package default is
  // preserved; the user opts into the local scope explicitly.
  return [...opts, { id: LOCAL_PACKAGE_ID, name: t('engine.package.local', detectLocale()) }];
}

/**
 * True for the runtime/null "Local / Custom" sentinel scope. Per ADR-0070 D5
 * this is a *migration* surface (move loose items into a base), never a valid
 * create destination — callers gate "create" on a real writable base.
 */
export function isLocalScope(id: string | null | undefined): boolean {
  return !id || id === LOCAL_PACKAGE_ID;
}

/**
 * The writable bases (project-scoped DB packages) from the raw package list —
 * the only valid authoring destinations (ADR-0070 D2). Excludes code/installed
 * (system|cloud) packages AND the Local sentinel.
 */
export function writableBaseOptions(
  rawList: unknown[] | null | undefined,
): { id: string; name: string }[] {
  return buildPackageScopeOptions(rawList).filter((o) => o.id !== LOCAL_PACKAGE_ID);
}
