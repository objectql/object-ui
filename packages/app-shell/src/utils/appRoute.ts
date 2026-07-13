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

/**
 * Deep-link from a running app straight to a specific **object's** design
 * surface in Studio's Data pillar — e.g. viewing the `account` records page
 * opens `/studio/:packageId/data?surface=object:account`, which the Data
 * pillar's `?surface=` restore honors (see `DataPillar` in
 * `StudioDesignSurface`). Same admin/package guards as
 * {@link appStudioDesignPath}; returns null when the object name is missing so
 * the caller can fall back to the plain Data tab.
 *
 * The `surface` param value is `object:<name>` — the same `type:name` shape the
 * Interfaces pillar uses; only the name is percent-encoded (`object` is a fixed
 * keyword).
 */
export function appStudioObjectPath(
  app: AppLike | null | undefined,
  isWorkspaceAdmin: boolean,
  objectName: string | null | undefined,
): string | null {
  if (!isWorkspaceAdmin) return null;
  const packageId = studioPackageId(app);
  if (!packageId) return null;
  if (!objectName) return null;
  const value = `object:${encodeURIComponent(objectName)}`;
  return `/studio/${encodeURIComponent(packageId)}/data?surface=${value}`;
}

/**
 * Route types that correspond to a designable **interface** surface in Studio's
 * Interfaces pillar. The console route type (`/apps/:pkg/<type>/<name>`) doubles
 * as the Studio surface type — the keywords match `resolveSurface` in
 * `StudioDesignSurface` (`dashboard` / `page` / `report`).
 */
const INTERFACE_SURFACE_ROUTE_TYPES = new Set(['dashboard', 'page', 'report']);

/**
 * Console `/apps/:pkg/<type>` route types that are NOT object records — the
 * interface surfaces (handled above) plus the `system` settings area. Any other
 * route type IS the object name (see `AppHeader`'s breadcrumb switch: the
 * `else if (routeType)` branch treats it as an object), so it deep-links the
 * Data pillar to that object.
 */
const NON_OBJECT_ROUTE_TYPES = new Set([...INTERFACE_SURFACE_ROUTE_TYPES, 'system']);

/**
 * App → Studio bridge target for a running-app route (ADR-0080). When the route
 * names a specific interface (a dashboard, page, or report — see
 * {@link INTERFACE_SURFACE_ROUTE_TYPES}), deep-link straight to THAT surface in
 * the Interfaces pillar via {@link appStudioSurfacePath}. When it names an
 * object record page (the route type IS the object name), deep-link that object
 * in the Data pillar via {@link appStudioObjectPath}. Otherwise (bare app root,
 * a `system` route, or an interface list route with no surface name) fall back
 * to the package's generic Data tab via {@link appStudioDesignPath}. Returns
 * null when the bridge should not render (non-admin / no owning package).
 * Centralizes the route-type → surface-type mapping so `AppHeader` stays
 * declarative and the decision is unit-tested here.
 */
export function appStudioRoutePath(
  app: AppLike | null | undefined,
  isWorkspaceAdmin: boolean,
  route: { type?: string | null; name?: string | null } | null | undefined,
): string | null {
  const type = route?.type;
  const name = route?.name;
  if (type && name && INTERFACE_SURFACE_ROUTE_TYPES.has(type)) {
    return appStudioSurfacePath(app, isWorkspaceAdmin, { type, name });
  }
  if (type && !NON_OBJECT_ROUTE_TYPES.has(type)) {
    return appStudioObjectPath(app, isWorkspaceAdmin, type);
  }
  return appStudioDesignPath(app, isWorkspaceAdmin);
}

/** Shared guard: the owning package id usable by the Studio design surface. */
function studioPackageId(app: AppLike | null | undefined): string | null {
  const packageId = app?._packageId;
  if (typeof packageId !== 'string' || !packageId || packageId === 'sys_metadata') return null;
  return packageId;
}
