---
'@object-ui/app-shell': patch
---

Set-default on a saved view fires its write again — a stored `id` can no longer rename the tab out from under the overlay read

"Set as default" could do nothing at all: no toast, no request, no change. The filer measured that the adapter cannot produce that — `ObjectStackAdapter.updateView` has no early return between its read and its `saveItem`, so every patch shape it is handed becomes a write — which put the cause above it, in the view switcher.

It was an identity seam. Views reach `ObjectView` through two independent reads of the same `type='view'` metadata namespace: the object definition's `listViews`, keyed by the composer's `<object>.<key>` identity, and the adapter's `listViews()` overlay rows. Everything that decides whether a view is mutable — the tab's `readonly` flag, the `isSavedView` guard, and the early return in all five mutating handlers — asks whether a tab's id is among the overlay keys. So the two reads have to spell the same view's identity the same way, and they had two different spellings to do it with. The overlay side stamped `id` last and was safe; the metadata side built each tab as `{ id: <key>, ...body, ...override }`, with `id` FIRST, so any `id` key inside the merged body or the stored override replaced it.

Both of those are stored documents that really do carry one. `persistViewPatch` writes the whole tab object — its `id` included — back through `updateViewConfig`, so a personalized view leaves an override row carrying an `id`; and a duplicated view copies its source artifact's `id` verbatim into the view body, which `MetadataProvider` spreads into the `listViews` entry. Either way the tab ended up under an id the overlay read had never heard of, the view was classified as system, and — because the set-default, rename and delete entries render only under `!readonly` — the menu entry was **absent** rather than present-and-inert. That is why the symptom reads as "nothing happened" instead of "refused": there was no control left to click, and the guard's toast was never reached.

The fix is one spelling instead of three. `viewRowId` answers "what is this row's identity" (`name` → `id` → `_id`, empty strings skipped) for the producer and every reader, and is idempotent across the overlay normalization so the key written and the key read back cannot drift. `viewEntry` stamps identity last at all three tab-building sites, so a tab id is a property of the key it was looked up by and never of the data. `isSavedViewId` is now the single predicate behind both the tab's `readonly` flag and the handler guard, so the menu and the handler agree by construction rather than by coincidence.

No behavior was loosened to get there: the guard is unchanged, and a genuine system view stays read-only with its mutating entries correctly absent.
