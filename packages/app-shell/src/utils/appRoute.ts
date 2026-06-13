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
