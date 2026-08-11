---
'@object-ui/console': patch
---

fix(console): a Setup-only environment lands on `/home`, not Setup's all-zero System Overview

A new builder arriving on a just-created environment (platform SSO, no explicit
target) landed on Setup's **System Overview** — a platform-health/audit
dashboard reading all zeros, because a fresh environment has no audit history
yet. The intended first screen is the environment's own home: build with AI,
start from a template, Your apps.

The path was `resolveLandingPath`'s rule 2. Measured end to end:

    /  →  RootLandingRedirect  →  resolveLandingPath([setup])
       →  rule 2 "single visible app"  →  /apps/setup
       →  AppContent.resolveLandingRoute() → the app's first nav item
       →  dashboard/system_overview

Rule 2 itself is right — a one-app PRODUCT deployment should not have to click
through a one-tile launcher. Setup is not that app: it is the platform
administration console that `@objectstack/platform-objects` ships into every
deployment, so "the only app this viewer can see is Setup" means *this
environment has no product apps yet*, not *Setup is the product*. Under ADR-0075
the environment layer's home is the environment's own responsibility, so that
case now resolves `/home`.

Deliberately narrow — everything else is byte-identical:

- a declared landing still wins (rule 1, `isDefault`, untouched): an admin
  console that genuinely wants Setup first says so, and gets it;
- a one-app product deployment still lands in its app;
- `[product, setup]` still resolves `/home` exactly as before — Setup is
  excluded from the single-app *outcome*, never from the visible *count*;
- the `/setup` deep link is unchanged: `/` is "an arrival with no target",
  `/setup` is an explicit one, and it still resolves into Setup.
