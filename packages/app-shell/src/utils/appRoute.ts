/**
 * ADR-0048 (option A) — the `/apps/<segment>` route is keyed on the **package
 * id** (reverse-domain, globally unique), not the app's display name. This makes
 * two vendors' same-named apps unambiguous and self-describing in the URL.
 *
 * - `appRouteSegment(app)` — the canonical route segment for linking TO an app
 *   (its package id; falls back to `name` for runtime/DB apps with no
 *   `_packageId`).
 * - `matchAppBySegment(apps, seg)` — resolve a route segment back to its app,
 *   preferring the package id and falling back to the app name. The name
 *   fallback doubles as a per-tenant friendly alias and keeps legacy
 *   name-based URLs/bookmarks working. Callers keep their own
 *   default/first-app fallback around this match.
 */

type AppLike = { name?: unknown; _packageId?: unknown } & Record<string, unknown>;

export function appRouteSegment(app: AppLike | null | undefined): string | undefined {
  if (!app) return undefined;
  const seg = (app._packageId as string | undefined) ?? (app.name as string | undefined);
  return seg ?? undefined;
}

export function matchAppBySegment<T extends AppLike>(
  apps: readonly T[] | null | undefined,
  seg: string | null | undefined,
): T | undefined {
  if (!apps || seg == null) return undefined;
  return apps.find((a) => a?._packageId === seg) ?? apps.find((a) => a?.name === seg);
}

/**
 * App → Studio reverse bridge (ADR-0080). Resolves a running app to its owning
 * package's design surface (`/studio/:packageId/data`), or `null` when there is
 * nothing to open:
 * - the viewer is not a workspace admin (designing mutates shared package
 *   metadata, so the entry point is admin-only — mirrors the runtime editors);
 * - the app has no owning package (runtime/DB apps), or its container is the
 *   DB-authored `sys_metadata` pseudo-package, which is not a package the
 *   Studio design surface can open.
 *
 * Writability of the target package is NOT checked here — the ADR-0070 D4 gate
 * stays the server-side authority, and the Studio surface itself renders
 * read-only packages as browse-only.
 */
export function appStudioDesignPath(
  app: AppLike | null | undefined,
  isWorkspaceAdmin: boolean,
): string | null {
  if (!isWorkspaceAdmin) return null;
  const packageId = studioPackageId(app);
  if (!packageId) return null;
  return `/studio/${encodeURIComponent(packageId)}/data`;
}

/**
 * Deep-link from a running app straight to a specific interface's design
 * surface in Studio's Interfaces pillar — e.g. viewing a dashboard opens
 * `/studio/:packageId/interfaces?surface=dashboard:<name>`, which the pillar's
 * `?surface=` restore honors (see `nav-selection.ts`). Same admin/package
 * guards as {@link appStudioDesignPath}; returns null when the surface identity
 * is incomplete so the caller can fall back to the plain design path.
 *
 * The `surface` param value is `type:name`; types never contain `:`, so the
 * pillar splits on the first colon. Only the name is percent-encoded — the
 * type is a fixed keyword (`dashboard`/`report`/…).
 */
export function appStudioSurfacePath(
  app: AppLike | null | undefined,
  isWorkspaceAdmin: boolean,
  surface: { type?: string | null; name?: string | null } | null | undefined,
): string | null {
  if (!isWorkspaceAdmin) return null;
  const packageId = studioPackageId(app);
  if (!packageId) return null;
  const type = surface?.type;
  const name = surface?.name;
  if (!type || !name) return null;
  const value = `${type}:${encodeURIComponent(name)}`;
  return `/studio/${encodeURIComponent(packageId)}/interfaces?surface=${value}`;
}

/** Shared guard: the owning package id usable by the Studio design surface. */
function studioPackageId(app: AppLike | null | undefined): string | null {
  const packageId = app?._packageId;
  if (typeof packageId !== 'string' || !packageId || packageId === 'sys_metadata') return null;
  return packageId;
}
