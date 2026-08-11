// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Where an internal `/forms/:name` submit lands — the console path of the
 * record it just created (objectui#4109, maintainer ruling 2026-08-10 on
 * objectstack#7245: "an internal submit lands on the record").
 *
 * Pure, router-free and metadata-free so the policy is unit-testable without
 * rendering the shell; `InternalFormRoute` feeds it the live app catalog.
 *
 * ## Why this needs an app at all
 *
 * A record page is app-scoped: `/apps/<segment>/<object>/record/<id>`, with the
 * segment being the owning package id and the app name as the runtime/DB
 * fallback (ADR-0048). There is no app-independent record route anywhere in the
 * console — every producer of a record link in `@object-ui/app-shell`
 * (`RecordDetailView`, `SearchResultsPage`, `useObjectActions`,
 * `InterfaceListPage`, …) builds this same shape. But `/forms/:name` names no
 * app, so one has to be chosen.
 *
 * ## Which app, and the honest limit of this copy
 *
 * app-shell answers exactly this question for framework-owned, app-independent
 * pages in `resolveHostAppSegment` (`utils/appRoute.ts`): prefer the app the
 * user is in or last had open, RE-CHECKED against the live active list; else
 * their first active app; else fall back further. Its docblock is emphatic that
 * the order is one hard-won definition, and duplicating it would be the "two
 * readers of one prose contract" mistake this repo keeps paying for.
 *
 * We would import it — but `@object-ui/app-shell` exports only its package
 * root, and that root re-exports `./utils` nowhere, so the helper is not
 * reachable from `apps/console` without widening app-shell's public surface.
 * That edit was out of scope for #4109 (a parallel agent holds app-shell), so
 * this implements the FIRST TWO steps only and then STOPS:
 *
 *   1. `preferred` — the app the user is in / last had open — re-checked
 *      against the live list, so an app deactivated or hidden since is not
 *      resurrected as a link;
 *   2. else their first openable app — arbitrary but reachable, and on a
 *      business user's workspace that is a business app;
 *   3. else `null` — NOT `setup`. That is the deliberate divergence: the
 *      upstream helper's last resorts exist so a framework page always renders
 *      SOMEWHERE, whereas an unresolvable app here means we cannot name the
 *      record's page at all, and the caller must confirm the submit instead of
 *      sending the user to a URL that resolves to nothing.
 *
 * Replacing all of this with the upstream helper is a pure deletion once it is
 * exported; the divergence at step 3 is the only judgement to re-make.
 */

/** The fields this resolver reads off an App metadata record. */
export interface HostAppLike {
  name?: unknown;
  /** ADR-0048 owning package — the canonical identity of a shipped app. */
  _packageId?: unknown;
  active?: unknown;
  hidden?: unknown;
}

/**
 * The `/apps/<segment>` route segment for an app: its package id, falling back
 * to its name for runtime/DB apps that have none. Mirrors app-shell's
 * `appRouteSegment` — same reason, same unavailability.
 */
function routeSegment(app: HostAppLike | undefined): string | null {
  if (!app) return null;
  const seg = (typeof app._packageId === 'string' && app._packageId) || null;
  if (seg) return seg;
  return typeof app.name === 'string' && app.name ? app.name : null;
}

/**
 * The apps a user can actually open. `active === false` deactivates an app;
 * `hidden === true` keeps it out of the launcher. Neither is a place to send
 * someone. (Deliberately NOT filtering `_unpublished`: it is the ADR-0045
 * publish gate and is enforced server-side — see app-shell's `filterActiveApps`
 * docblock — so filtering it here would hide a builder's own app from the
 * builder and buy nothing.)
 */
function openableApps(apps: readonly HostAppLike[] | null | undefined): HostAppLike[] {
  if (!apps) return [];
  return apps.filter((a) => a?.active !== false && a?.hidden !== true);
}

/**
 * Which app should host the created record's page, as a route segment, or
 * `null` when none can be named. See the module docblock for the order.
 */
export function resolveRecordHostAppSegment(
  apps: readonly HostAppLike[] | null | undefined,
  preferred: string | null | undefined,
): string | null {
  const openable = openableApps(apps);
  if (preferred) {
    const stillOpenable =
      openable.find((a) => a._packageId === preferred) ??
      openable.find((a) => a.name === preferred);
    const seg = routeSegment(stillOpenable);
    if (seg) return seg;
  }
  return routeSegment(openable[0]);
}

/**
 * The console path of a freshly created record, or `null` when it cannot be
 * built — no openable app to host it, or a caller with no object/id. A null
 * return is a supported answer, not a failure: `FormPage` confirms the submit
 * instead of navigating to a path that resolves to nothing.
 *
 * `recordId` is percent-encoded (ids are opaque and may carry `/` or `#`);
 * `objectName` and the app segment are metadata identifiers, encoded for the
 * same reason every other producer of this shape does.
 */
export function buildCreatedRecordPath(
  apps: readonly HostAppLike[] | null | undefined,
  preferredAppName: string | null | undefined,
  objectName: string | null | undefined,
  recordId: string | null | undefined,
): string | null {
  if (!objectName || !recordId) return null;
  const appSegment = resolveRecordHostAppSegment(apps, preferredAppName);
  if (!appSegment) return null;
  return `/apps/${encodeURIComponent(appSegment)}/${encodeURIComponent(objectName)}/record/${encodeURIComponent(recordId)}`;
}
