---
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-calendar': patch
---

`object-gantt` / `object-map` / `object-calendar` no longer drop a sort entry that omits `order`.

The three blocks each inlined a byte-identical private copy of the `sort` →
`$orderby` conversion. That copy required BOTH `field` and `order` on an array
entry and silently skipped any entry missing one, so a stored view sorting by
`[{ field: 'amount' }]` reached the wire with no ordering at all — the authored
sort key was lost, not applied. The same copy already treated the STRING
spelling `"amount"` as ascending, so this was an inconsistency between two
spellings of one thing rather than deliberate strictness.

All three now import the shared `convertSortToQueryParams` sink from
`@object-ui/core` (introduced by objectstack#7137, already used by
`object-timeline` and `record:line_items`), and the private copies are gone —
the sink is the repo's only definition. Two behavior changes come with it, both
of which make the blocks more faithful to what is already declared rather than
more tolerant:

- An array entry that omits `order` now orders ASCENDING instead of vanishing.
  That is what `QueryParams.$orderby`'s own member shape
  (`{ field: string; order?: 'asc' | 'desc' }`) says, and what
  `@object-ui/data-objectstack`'s `serializeOrderBy` already did with a missing
  direction.
- When nothing orderable was authored, the query now carries no `$orderby` at
  all instead of an empty object. `{}` is truthy and meant "no ordering" only by
  accident of the adapter's serializer.

Reachability, so the size of this is not overstated: `SortConfig.order` and
`ElementDataSourceSort.order` are REQUIRED in objectui's own types, so a typed
caller could never author the dropped shape. The affected surface is untyped
stored view metadata (`ElementSavedView` is a loose record by design) — which is
exactly where an order-less entry can arrive today.
