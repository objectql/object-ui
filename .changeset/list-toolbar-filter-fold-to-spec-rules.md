---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

The list toolbar's "Filter" now saves. Saving a filter from the runtime toolbar PUT the FilterBuilder's whole group object (`{ id, logic, conditions }`) into the view's `filter`, where `@objectstack/spec`'s `ListViewSchema.filter` declares `ViewFilterRule[]` — so every save came back `422 invalid_metadata` and the filter was silently never persisted (objectstack#5159).

The producer now folds the builder's group to the spec's flat `{ field, operator, value }` rule list before persisting, sharing one transform with the Studio view inspector (which had the only copy). Operators normalize through the spec's own `normalizeFilterOperator`, so the four builder operators the Studio's local table had drifted behind — `startsWith`, `endsWith`, `isNull`, `isNotNull` — now persist correctly too. The builder's per-row `id` is no longer written: it is a React list key that the read path regenerates, so stored view bodies keep the declared vocabulary only.

A filter whose shape cannot be represented losslessly as a flat rule list — `OR` across several conditions, or nested condition groups — is now refused with a translated message instead of being quietly saved as `AND`, which would have returned a different set of records than the one on screen. Such a filter still applies to the current list; it just does not become part of the saved view.
