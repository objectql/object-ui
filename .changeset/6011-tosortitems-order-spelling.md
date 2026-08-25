---
'@object-ui/plugin-view': minor
---

**Breaking (shipped as `minor` per AGENTS.md §版本号策略).** The published `toSortItems`
export now reads its sort direction from **`order`** only. The retired spelling is
**`direction`** — named here so that a host still writing it can find this entry by
searching the old key (objectui#6011).

```diff
  import { toSortItems } from '@object-ui/plugin-view';

- toSortItems([{ field: 'created_at', direction: 'desc' }]);
+ toSortItems([{ field: 'created_at', order: 'desc' }]);
```

**What changed, exactly.** `toSortItems` folded `s.order || s.direction || 'asc'`: two
spellings for one key, silently preferring the canonical one. It now folds
`s.order || 'asc'`. Everything else about the helper is unchanged — `id` is still
preserved when present and minted with `crypto.randomUUID()` otherwise, `field` still
defaults to `''`, and a non-array draft still yields `[]`.

**The failure mode if you do not migrate is silent.** A draft entry spelled
`{ field: 'created_at', direction: 'desc' }` used to produce
`{ field: 'created_at', order: 'desc' }`; it now produces
`{ field: 'created_at', order: 'asc' }` — the documented default for an entry that names
no direction. Nothing throws and nothing warns: the `SortBuilder` row renders, and it
renders **ascending**. If you have a studio inspector draft, a persisted view body, or any
other producer that still writes `direction`, grep for the key and re-spell it to `order`.

**Why the tolerant read went rather than staying.** objectui#4869 ruled that a spelling the
sink does not recognise gets ruled into the contract or rejected at the producer, never
absorbed by a tolerance layer. objectui#5293 retired the same word on
`ObjectViewProps.views[].sort` and shipped it as a `minor`; this entry finishes the job on
the sort family's public surface, so `order` is now the one spelling repo-wide and declared
equals enforced. The scope note in the objectui#5293 entry — that this export was *not*
retired by that change — described that release's scope correctly and is superseded here.

`SortUI` is untouched. Its own file-local `toSortItems` is a different symbol, and
`direction` is the key `SortUISchema` legitimately declares.
