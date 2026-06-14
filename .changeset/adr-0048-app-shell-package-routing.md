---
"@object-ui/app-shell": minor
---

feat(app-shell): ADR-0048 (option A) — package-id app routing + prefer-local resolution

Apps are now routed by their canonical package id rather than name:

- **Resolution layer** — new `appRoute` helpers: `appRouteSegment(app)`
  (canonical link segment = package id, name fallback) and
  `matchAppBySegment(apps, seg)` (prefers `_packageId`, falls back to `name`).
  `AppContent` selects the active app via `matchAppBySegment`, so
  `/apps/<packageId>` resolves while `/apps/<appName>` keeps working (a per-tenant
  alias / legacy URL).
- **Emission layer** — nav generates `/apps/<packageId>` links across app
  switching (AppSwitcher/AppSidebar/CommandPalette), sidebar base paths,
  create/edit-app, and the hidden-app switch, all via `appRouteSegment(app)`.
- **Prefer-local resolution** — `preferLocal(list, name, ownerPackageId)` resolves
  a bare metadata name to the item whose `_packageId` matches the active app's
  package (falling back to first match), wired at PageView/DashboardView/
  ReportView and AppHeader so two installed packages can ship the same bare name.
