// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio builder component registration.
 *
 * Binds the `studio:builder` registry key (referenced from the framework's
 * Studio app navigation — the 「应用构建」 entry) to the builder landing page,
 * so the application builder is reachable from the moment a user logs in:
 * Home → Studio app → 应用构建 → pick/create a writable package → the
 * full-screen pillar builder at `/studio/:packageId/:tab`.
 *
 * URL shape resolved by `ComponentNavView`:
 *   studio:builder → /apps/<app>/component/studio/builder
 *
 * The standalone `/studio` route renders the same landing full-screen.
 */

import { lazy, Suspense } from 'react';
import { registerAppComponent } from '@object-ui/app-shell';

const BuilderLandingLazy = lazy(() =>
  import('@object-ui/app-shell').then((m) => ({ default: m.BuilderLanding })),
);

registerAppComponent({
  ref: 'studio:builder',
  label: '应用构建',
  source: '@objectstack/console',
  component: (props: any) => (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载应用构建器…</div>}>
      <BuilderLandingLazy {...props} />
    </Suspense>
  ),
});
