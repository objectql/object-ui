---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
---

Publishing a view from the console no longer serves a five-minute-stale override map — every writer now routes through one invalidation seam

`ObjectStackAdapter` caches two view-shaped reads: `getView` under `view:{object}:{name}` and `listViewOverrides` under `view-overrides:{object}`, with `MetadataCache`'s default 5-minute TTL. objectui#4363 made the adapter's own four write paths drop both. But the console's real create-a-view flow never calls any of them: `ObjectView.handleViewCreate` writes through the ADR-0034 metadata seam (`createRuntimeMetadata` → `metadataClient.save`), and Publish goes `RuntimeDraftBar` → `publishRuntimeMetadata` → `metadataClient.publish`. Two writers into the same `/meta/view/:name` rows; only one of them invalidated anything.

Publish is the sharp end. A create lands an invisible per-item draft, and `listViewOverrides` enumerates published rows, so the map is still honest there. Publish promotes the row into exactly the world the map describes — and nothing dropped the key, so the object page kept applying its pre-publish snapshot for the rest of the TTL. It does not self-heal: `loadViewOverrides` treats a resolved map as authoritative and deliberately does not re-probe per view (objectui#3774, correct — re-probing reinstates the 404 flurry the batch read exists to remove), so the per-view `getView` fallback that would have masked a stale map is by design unreachable.

The fix is one seam rather than a fifth copy of the key list. `ObjectStackAdapter.invalidateViewKeys(objectName, viewName)` is now the only place that knows which keys a view-row write drops; the adapter's four write paths call it instead of restating the pair, app-shell's ADR-0034 persistence module calls it for `view` saves, creates, publishes and discards, and `MetadataService.saveMetadataItem` calls it when the category is `view` (where it previously named `view:{name}`, which no reader has). Restatement is what this repo keeps paying for — objectui#3778 removed five copies of a key no reader populated, objectui#4363 fixed four copies that named half the live set, and objectui#4373 is the measured proof that a new writer forgets the list by default. A pin suite can only guard writers that exist; a seam makes the next one unable to forget.

No cache key, no read path and no public signature changed. The adapter's eight existing invalidation pins pass unchanged, which is the evidence that routing four paths through a seam changed nothing observable; two new structural guards keep the key set from being restated again — one asserting each key template appears exactly twice in the adapter (its reader, and the seam), one asserting no app-shell file spells either.
