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
- `ListView`'s data fetch now depends on a serialised `expandKey` rather than
  on the `expandFields` array.

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
of content still refetches exactly as before.

One correction to the census card's account, measured while pinning it: for
`page:tabs` the redundant probe costs nothing on the wire.
`RelatedCountStore.fetch` returns the cached count as its first act and dedupes
concurrent probes, so the extra work is the effect re-running, not an extra
request.
