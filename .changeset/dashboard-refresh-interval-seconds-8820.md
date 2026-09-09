---
"@object-ui/plugin-dashboard": minor
"@object-ui/app-shell": minor
---

Dashboard auto-refresh reads the renamed `refreshIntervalSeconds` key, so a dashboard authored against `@objectstack/spec` 17.4.0 starts its timer again.

`@objectstack/spec` 17.4.0 renamed `dashboard.refreshInterval` to `refreshIntervalSeconds` (the value is unchanged — still seconds; only the key moved, so the unit lives in the name rather than only in the describe prose). The two dashboard timers still read the old key, so from the moment an app adopted 17.4.0 its auto-refresh had no reader and silently never started.

Both spellings are now accepted, new preferred, so the fix is order-independent with respect to the apps it serves: an app already on 17.4.0 refreshes immediately, and one still on 17.3.0 keeps working. The preference is by PRESENCE, not truthiness — an explicit `refreshIntervalSeconds: 0` means "off" and is no longer overridden by a stale `refreshInterval` left behind by a half-finished migration.

The timer itself was two byte-identical copies (`DashboardGridLayout`, `DashboardRenderer`); they are now one `useDashboardAutoRefresh` hook, which is also the single place the authored period is read. The new pin observes the timer FIRING on both components and from both spellings — the existing tests all pinned the declaration, which is the class of test that stays green while the feature is dead.

The zh metadata-admin overlay carries both field names, so the 自动刷新 label survives the spec bump instead of falling back to English on the day it lands.

The published `inputs` declaration and the config-panel field key deliberately still spell it `refreshInterval`: those surfaces PUBLISH and EMIT the key rather than read it, and objectui resolves `@objectstack/spec@17.3.0`, where `refreshIntervalSeconds` is refused by name. They move with the spec floor. `packages/plugin-report` is untouched — `report.refreshInterval` is a different schema that did not rename.
