---
"@object-ui/app-shell": minor
---

feat(console): entitlement- & state-aware environment actions

The `sys_environment` list now presents the right create affordance for the
org's state (born-with-env) instead of POST-then-error:

- **No production env** (historical orgs) → "Set up your production environment";
  the create POST provisions the org's one production env — this path never errors.
- **Has prod env, free plan** → an "Add environment" button that opens a friendly
  upgrade prompt (CTA to billing) instead of POSTing into a 403.
- **Has prod env, paid plan** → "Add development environment" creates a dev env.

The action runtime's `apiHandler` now also turns the cloud env-create entitlement
403s (`DEV_ENV_PLAN_LOCKED` / `DEV_ENV_LIMIT` / `PRODUCTION_ENV_LIMIT`) into a
friendly upgrade/limit dialog with a CTA rather than a red error toast — a safety
net that covers any path. State is resolved from the new org-scoped
`GET /cloud/environment-entitlements` summary, with a row-derived `hasProductionEnv`
fallback so the production-setup path works even against an older control plane.
