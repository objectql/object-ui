---
'@object-ui/app-shell': patch
'@object-ui/data-objectstack': patch
'@object-ui/types': patch
---

A system (code-defined) view's personalization overlay row no longer masquerades as a user-created saved view.

Toggling density / sort / hidden columns / column widths / inline-edit on a code-defined view persists a row under the same `type='view'` metadata namespace a genuinely saved view lives in, keyed by the same id (`ObjectStackAdapter.updateViewConfig`). `listViews()` previously returned that row indistinguishably from a real saved view, so `ObjectView`'s `isSystem = !saved` check flipped to `false` and the tab gained Rename / Delete / Set-default / Pin against a view that lives in code — `handleDeleteView` would even call `dataSource.deleteView` on it.

Two layers now keep the two kinds of rows apart:

- **Write side**: `updateViewConfig` — the only production writer of personalization overlays — stamps an explicit `_isOverride: true` discriminant on every row it saves, UNLESS the write targets an already-saved view's own row (see below).
- **Read side**: `listViews()` excludes any row carrying that marker, and (for rows already persisted before this fix shipped) a best-effort legacy shape: a flat body with a `viewKind` the platform can only have server-side-backfilled from a registry (code-defined) baseline — a genuine runtime-created saved view never has one.

`listViewOverrides()` (the reader `ObjectView` uses to merge these settings back into the live view for display) is unchanged — it is supposed to keep seeing overlay rows.

The overlay this stores is **org-wide shared view settings**, not a per-user preference (a true per-user scope is a parked platform-side v18 direction) — comments describing it as "personal" have been corrected to say so.

**Follow-up fix (same card, post-review):** `updateViewConfig`'s ONE call site (`ObjectView`'s toolbar-driven toggle) fires for a toggle on EITHER a system view OR an already-saved view — a saved view whose own toolbar the user toggles writes to that same view's own row. Stamping the overlay marker unconditionally there would flag the user's own saved view as an overlay and make `listViews()` exclude it on the very next read, i.e. the saved view would vanish from the switcher the moment its density was adjusted. `updateViewConfig` gains an optional `opts.isSavedView` parameter (also added to the `DataSource` interface in `@object-ui/types`); `ObjectView` passes it from the same `isSavedViewId` classification its readonly gate and mutating handlers already use, and the marker is withheld when it's true.
