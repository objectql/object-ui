// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `/studio/*` — the ENTRY gate for the Studio pillar builder.
 *
 * The policy, and why its fail direction is inverted from every other capability
 * gate in this app, live in `./studioEntry`. This file is only the mapping from
 * verdict to element, and the place the gate is MOUNTED.
 *
 * ## Mounted once, above the whole subtree — on purpose
 *
 * `App.tsx` declares the Studio routes as CHILDREN of this element rather than
 * gating each leaf, so:
 *
 *  - the permission answer is fetched once per Studio session, not once per
 *    route, and client-side transitions inside Studio keep the gate mounted;
 *  - a route added under `/studio` later cannot forget to gate itself. That is
 *    the property worth having: the previous shape had every `/studio` leaf
 *    carrying its own (auth-only) wrapper, which is exactly how an entry gate
 *    drifts leaf by leaf.
 *
 * Ordering is `ProtectedRoute` → gate: an unauthenticated visitor gets this
 * host's ONE auth-redirect contract (`/login?redirect=%2Fstudio…`, built by
 * `LoginRedirect` from the ROUTER's location), not a capability bounce — and the
 * permissions endpoint has a session to answer about by the time it is called.
 *
 * ## ⛔ The server is NOT the seam
 *
 * `createConsoleStaticPlugin` is a static-file plugin: it has no per-route
 * knowledge (one `/_console/*` catch-all, one `index.html`), it sees only HARD
 * navigations — so a server 404 would close the deep link and leave client-side
 * route transitions wide open — and it has no session, so it could only
 * blanket-block the path for EVERY principal, including the platform operators
 * Studio exists for. The gate belongs here, in this app's router.
 */

import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LoadingFallback, LoadingScreen } from '@object-ui/app-shell';

import { ProtectedRoute } from './ProtectedRoute';
import { holdsStudioAccess, useStudioEntry } from './studioEntry';

/**
 * Renders `children` only for a principal whose LOADED capability set contains
 * `studio.access`; every other state renders something that is not the builder.
 *
 * Exported separately from {@link StudioRoute} so the decision can be exercised
 * against a real router without the auth/shell stack in the way.
 */
export function RequireStudioAccess({
  children,
  redirectTo = '/home',
}: {
  children: ReactNode;
  /** Where a non-holder lands. Home, not a dead end — same posture as `RequireAiSurface`. */
  redirectTo?: string;
}) {
  const entry = useStudioEntry();

  // Loading window. The builder must not mount for a single frame while the
  // answer is in flight — "not yet loaded" is not permission.
  if (entry.status === 'pending') return <LoadingFallback />;

  // Fetch failed outright (non-transient status, or the retries exhausted).
  // The console's error splash carries a Retry, so this is recoverable for a
  // genuine operator; what it never does is fall through to the builder.
  if (entry.status === 'failed') {
    return <LoadingScreen error={entry.error.message} onRetry={entry.retry} />;
  }

  if (!holdsStudioAccess(entry.systemPermissions)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

/** Route element for the `/studio` subtree: auth, then entry capability, then children. */
export function StudioRoute() {
  return (
    <ProtectedRoute>
      <RequireStudioAccess>
        <Outlet />
      </RequireStudioAccess>
    </ProtectedRoute>
  );
}
