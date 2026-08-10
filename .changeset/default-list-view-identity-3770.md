---
"@object-ui/app-shell": patch
---

Ask the view composer for a container's view identities instead of deriving `list.name || 'list'`, so the default list view's translated label resolves

A `defineView` container declares its default list under the `list` key. That key is a slot in the authoring document, not the view's identity: `expandViewContainer` — the same composer the framework's loader and the i18n extractor call — registers an unnamed default list as `<object>.default`. This renderer derived `list.name || 'list'` instead, a third spelling no producer emits, so a default-list-only object probed `objects.<object>._views.list.label`, missed the published `_views.default.label` key (objectstack#5164 ruling A, migrated in objectstack#6124) and fell back to the English metadata label — for the view's description and empty state too.

- `MetadataProvider.mergeViewsIntoObjects` now expands a stack-packaged container through `expandViewContainer` and routes the result through the same code path as first-class ViewItems. Both authoring gates therefore key `listViews` / `formViews` by the canonical `<object>.<key>` identity, and the container inherits the composer's folding (a `listViews` entry that merely restates `list` collapses into one view) and collision renaming instead of restating them locally.
- `ObjectView` resolves the primary view's id through the new `defaultListViewId` helper — one derivation shared by the view-override lookup and the view-switcher promotion, with no literal fallback.

The renamed id is also the key a view override is persisted under (`updateViewConfig(object, viewId, …)` writes a `view` metadata record named by the id). Nothing is orphaned: the retired `'list'` spelling is not a representable view identity at all — `ViewItemNameSchema` requires a dotted `<object>.<key>` name — while the record-gate path, which real backends serve, already used the qualified id. Stale `/view/list` links fall back to the object's default view, which is the same view they named.
