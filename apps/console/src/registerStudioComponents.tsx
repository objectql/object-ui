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
 *
 * ## Why `BuilderLanding` is imported directly, and must stay that way
 *
 * This registration used to read `lazy(() => import('@object-ui/app-shell')
 * .then((m) => ({ default: m.BuilderLanding })))` behind a `Suspense`
 * fallback. That laziness never existed (objectui#5486). Two independent
 * reasons, either one sufficient:
 *
 *   1. the `import()` named the very specifier the line above it imports
 *      statically for `registerAppComponent`, so it could not move a module
 *      into another chunk; and
 *   2. `App.tsx` imports `BuilderLanding` from that same barrel anyway, to
 *      render the standalone `/studio` landing full-screen — the component is
 *      in the eager graph regardless of what this file does.
 *
 * So the code claimed a code split it did not have. The visible cost was an
 * `INEFFECTIVE_DYNAMIC_IMPORT` warning on every console build and a loading
 * fallback no user could ever see; the more expensive cost was that the next
 * reader believed the builder was deferred, and that one more permanent build
 * warning trains everyone to skim past build warnings.
 *
 * This is a TRUTHFULNESS fix and it moves ZERO bytes — measured before/after
 * on `apps/console/dist/eager-closure.json`, the eager closure is byte-for-byte
 * unchanged. Do not describe it as a bundle win.
 *
 * The `lazy()` SHAPE is not the mistake — naming a barrel you already import
 * statically is. Contrast the sibling `registerAccountComponents.tsx`, whose
 * `lazy()` names `./pages/system/ProfilePage`, a specifier nothing else pulls
 * in statically; that one is real and rolldown says nothing about it.
 *
 * Making the builder GENUINELY lazy is a different change with a different
 * risk: it means taking `App.tsx` off the static import too, which changes how
 * `/studio` mounts, and it only pays if app-shell's own graph cleaves usefully
 * behind the barrel — measurable, not assumable. That was ruled a separate
 * measured card, not a rider here.
 */

import { registerAppComponent, BuilderLanding } from '@object-ui/app-shell';

registerAppComponent({
  ref: 'studio:builder',
  label: '应用构建',
  source: '@object-ui/console',
  component: BuilderLanding,
});
