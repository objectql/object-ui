// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RootLandingRedirect — element for `<Route path="/" />`.
 *
 * Resolves the post-login landing from APP METADATA, so any product built on
 * the framework (cloud's control plane, an ISV's product, a per-project
 * runtime) declares its landing in source rather than forking the Console. This
 * replaces the previous hardcoded `PREFERRED_APPS = ['cloud_control']` redirect,
 * which baked one product's policy into the shared bundle.
 *
 * The landing is a build/dev-time PRODUCT decision, declared in metadata — not a
 * runtime, per-tenant, Settings-UI preference. Resolution order (see
 * {@link resolveLandingPath}):
 *   1. the App marked `isDefault: true` → `/apps/<it>` — and that App's own
 *      `homePageId` then selects the landing page within it;
 *   2. else the single visible App (`active !== false && hidden !== true`)
 *      → `/apps/<it>` (a one-app deployment shouldn't show a one-tile launcher);
 *   3. else `/home` — the multi-app workspace launcher (the legacy default).
 *
 * NOTE: this gives `isDefault` ROUTING semantics; it was previously a
 * display-only badge. Back-compat: a deployment with no `isDefault` App and ≥2
 * visible Apps still lands on `/home`, exactly as before. (A deploy-time ops
 * override is intentionally kept server-side, not read here — the metadata
 * declaration is the source of truth.)
 */

import { Navigate } from 'react-router-dom';
import { useMetadata, LoadingFallback } from '@object-ui/app-shell';

/** Minimal shape this resolver needs off each App metadata record. */
interface LandingApp {
  name?: string;
  isDefault?: boolean;
  active?: boolean;
  hidden?: boolean;
}

/**
 * The path `/` should redirect to, resolved purely from the App list. Extracted
 * from the component so the policy is unit-testable without a router/render.
 */
export function resolveLandingPath(apps: readonly LandingApp[] | null | undefined): string {
  const list = (apps ?? []).filter((a): a is LandingApp & { name: string } => Boolean(a?.name));

  // 1. The App the product declared as default (isDefault now ROUTES, not just badges).
  const defaultApp = list.find((a) => a.isDefault === true);
  if (defaultApp) return `/apps/${defaultApp.name}`;

  // 2. A single-app deployment lands straight in that App (no one-tile launcher).
  const visible = list.filter((a) => a.active !== false && a.hidden !== true);
  if (visible.length === 1) return `/apps/${visible[0].name}`;

  // 3. Multi-app default: the workspace launcher.
  return '/home';
}

export function RootLandingRedirect() {
  const { apps, loading } = useMetadata();
  if (loading) return <LoadingFallback />;
  return <Navigate to={resolveLandingPath(apps as LandingApp[] | undefined)} replace />;
}
