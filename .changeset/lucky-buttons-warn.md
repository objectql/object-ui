---
'@object-ui/plugin-detail': patch
---

`record:activity` now says out loud when an unrecognised `filterMode` is folded onto `all`.

`normalizeFilterMode` folds every value it does not recognise onto `'all'` — the widest of the four declared modes — so a near-miss like `comments-only` opened the panel on the unfiltered stream instead of the slice the author asked for, and said nothing. The fallback is kept (a dropdown handed a value with no matching item renders blank), but the fold now emits one deduped diagnostic naming the offending value and the declared modes. Nothing that renders changes.
