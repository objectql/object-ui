---
'@object-ui/console': minor
---

feat(console): resolve the post-login landing from app metadata, not a hardcode

The root route (`/`) previously redirected via a hardcoded
`PREFERRED_APPS = ['cloud_control']` in `CloudAwareRootRedirect` — baking one
product's policy (cloud) into the shared Console, with no supported way for a
deployment to opt out of the `/home` launcher or land somewhere custom without
forking the SPA.

`CloudAwareRootRedirect` is replaced by `RootLandingRedirect`, which resolves the
landing purely from app metadata (`resolveLandingPath`, unit-tested):

1. the app marked `isDefault: true` → `/apps/<it>` (its own `homePageId` then
   selects the landing page within it);
2. else the single visible app (`active !== false && hidden !== true`) → that app;
3. else `/home` — the multi-app workspace launcher (legacy default).

This gives `isDefault` **routing semantics** (it was a display-only badge) — a
back-compat-relevant contract change. Back-compat: a deployment with no
`isDefault` app and ≥2 visible apps still lands on `/home`, exactly as before;
cloud is unaffected (`cloud_control` is already `isDefault: true`) and the
cloud-specific hardcode is removed. The landing is now a build-time product
decision a developer declares in metadata, not a runtime Settings-UI preference.
