---
'@object-ui/data-objectstack': patch
---

Every view write path now invalidates the override map — a created, renamed or deleted view is no longer shadowed by a five-minute-stale batch read

`ObjectStackAdapter` caches two view-shaped reads: `getView` under `view:{object}:{viewId}`, and `listViewOverrides` under `view-overrides:{object}`. Four write paths touch view rows, and until now exactly one of them — `updateViewConfig` — invalidated the second key. `createView`, `updateView` and `deleteView` invalidated only the per-view key, so the batch override map kept answering from a snapshot taken up to `MetadataCache`'s default 5-minute TTL earlier.

That gap does not heal itself. `loadViewOverrides` in app-shell's `ObjectView` treats a resolved map as authoritative and deliberately does not re-probe per view — that is objectui#3774's fix, and it is correct, since re-probing reinstates the 404 flurry the batch read exists to remove. So the per-view `getView` fallback that would have masked a stale map is by design unreachable, and the stale map is served in full. Meanwhile `listViews` is uncached and answers fresh, so the view switcher could list a view whose override body came from a map written minutes earlier: the sharpest shape is the rename/pin path (`updateView`), where a user edits a view, returns to the object, and is served the pre-edit override.

All four paths now emit the same ordered pair — the per-view key, then the object's override map. The rule is uniform per method rather than per branch: `updateView`'s draft half invalidates both keys as its published half does, which is deliberate over-invalidation (both readers enumerate published rows, so a draft write stales neither) chosen because an unnecessary invalidation costs one refetch while a missed one costs the full TTL. `createView` names the per-view key too, because `saveItem` is an upsert and an explicit `spec.name` that already exists overwrites a published row a prior `getView` may hold.

No signature, no cache key and no read path changed; the only difference is which keys each write drops. The pin suite added by objectui#4328 now asserts the full invalidation key set for all five call sites, with the sweep's two pins kept as untouched controls: `listViews` stays uncached, and no write path names the retired `views:{object}` key.
