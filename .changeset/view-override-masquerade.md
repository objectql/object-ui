---
'@object-ui/app-shell': patch
'@object-ui/data-objectstack': patch
---

A system (code-defined) view's personalization overlay row no longer masquerades as a user-created saved view.

Toggling density / sort / hidden columns / column widths / inline-edit on a code-defined view persists a row under the same `type='view'` metadata namespace a genuinely saved view lives in, keyed by the same id (`ObjectStackAdapter.updateViewConfig`). `listViews()` previously returned that row indistinguishably from a real saved view, so `ObjectView`'s `isSystem = !saved` check flipped to `false` and the tab gained Rename / Delete / Set-default / Pin against a view that lives in code — `handleDeleteView` would even call `dataSource.deleteView` on it.

Two layers now keep the two kinds of rows apart:

- **Write side**: `updateViewConfig` — the only production writer of personalization overlays — stamps an explicit `_isOverride: true` discriminant on every row it saves.
- **Read side**: `listViews()` excludes any row carrying that marker, and (for rows already persisted before this fix shipped) a best-effort legacy shape: a flat body with a `viewKind` the platform can only have server-side-backfilled from a registry (code-defined) baseline — a genuine runtime-created saved view never has one.

`listViewOverrides()` (the reader `ObjectView` uses to merge these settings back into the live view for display) is unchanged — it is supposed to keep seeing overlay rows.

The overlay this stores is **org-wide shared view settings**, not a per-user preference (a true per-user scope is a parked platform-side v18 direction) — comments describing it as "personal" have been corrected to say so.
