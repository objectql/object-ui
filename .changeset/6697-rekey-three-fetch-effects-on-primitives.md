---
'@object-ui/plugin-detail': patch
'@object-ui/components': patch
'@object-ui/plugin-list': patch
---

Re-key three more renderer effects onto the primitives they actually read,
instead of the memoised object identity that produced them (objectui#6697 —
the three census members from objectui#6592 that sit outside its
`getDataConfig(schema)` family):

- `RelatedList`'s collection fetch now depends on `defaultSortKey` /
  `filterKey` (the `JSON.stringify`-derived content strings the two memos are
  already keyed on) rather than on `defaultSortSpec` / `listFilterNode`.
- `page:tabs`' related-count probe now depends on a serialised `probeKey`
  rather than on the `probeTargets` `Map`.
- `ListView`'s data fetch now depends on the `expandFields` memo's own INPUTS
  — `schema.columns`, the alternate views' binding blocks and
  `objectDef?.fields`, all props and state a discard cannot move — rather than
  on the `expandFields` array the memo returns.

`useMemo` carries no semantic guarantee — React is permitted to discard a memo
cache and recompute even when its dependency array compares equal to the
previous render — and all three factories return a FRESH value on every call
(`normalizeSortSpec`/`toFilterNode` build a new array / a freshly lowered AST,
the probe factory builds a new `Map`, `buildExpandFields` returns a new array
in every branch). So each effect re-ran on a discard alone, with nothing an
author or a caller controls having changed: an extra `dataSource.find` for the
related collection, an extra `dataSource.find` for the list window, and a
redundant re-probe of every tab's count. Keying on the primitives makes a
cache discard a no-op and returns `useMemo` to being a pure optimisation.

Severity is low and the fix is deliberately narrow: the observable was a
redundant round trip, never incorrect data, so only the re-run condition
moves — each effect body still reads the memoised value, and a genuine change
still refetches exactly as before.

The three take two routes on purpose — key on the nearest DISCARD-IMMUNE
thing. `RelatedList`'s memos are keyed on exactly one primitive each, and
`page:tabs`' probe memo is keyed on another MEMO's output (`items`), which is
not discard-immune, so both take a content string. `ListView`'s memo is keyed
on props and state, so it names those directly: a value key over
`expandFields` would NOT have been content-equivalent there — `buildExpandFields`
collapses the collected set down to the relation roots, while the effect body
also builds `$select` from `schema.columns` and the view bindings — and it
would have defeated objectui#4567's live-dependency pin, which ruled that
"ListView's by-identity dependency is correct for a real column change" and
put the identity stabilisation at the PRODUCER.

One correction to the census card's account, measured while pinning it: for
`page:tabs` the redundant probe costs nothing on the wire.
`RelatedCountStore.fetch` returns the cached count as its first act and dedupes
concurrent probes, so the extra work is the effect re-running, not an extra
request.
