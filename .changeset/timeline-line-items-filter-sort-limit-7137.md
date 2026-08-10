---
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-form": patch
"@object-ui/core": patch
---

`object-timeline` and `record:line_items` now apply the filter / sort / row cap they are given, so a named `dataSource.view` narrows them instead of contributing nothing

These were the two residual gaps in objectstack#7121's per-block coverage table
(objectstack#7137). Both blocks are object-bound lists, both accepted the spec's
per-element `dataSource` binding, and neither had a read site for `filter` or
`sort` anywhere in its fetch:

- `object-timeline`'s entire query was
  `find(objectName, { options: { $top: 100 } })`.
- `record:line_items`' was the parent FK plus a fixed `$top: 500`.

So `dataSource: { object, view: 'hot' }` resolved the view — a typo still reported
a configuration error, it never degraded into an unfiltered query — and then
dropped everything the view said. The rendered rows could be **wider than the view
they named**, silently, which is exactly the class of mistake AI-authored metadata
hides best: the page looks like it works. objectstack#7121 deliberately left the
keys unmapped and recorded the gap rather than writing composed values onto schema
keys nobody read; this closes it at the fetch instead.

What each block now reads:

- **`object-timeline`** — `$filter: schema.filter`,
  `$orderby: convertSortToQueryParams(schema.sort)`, and
  `$top: schema.limit ?? 100`, matching the form `object-gantt` / `object-map` /
  `object-calendar` already use. Its registry mapping gains
  `filter` / `sort` / `limit`; `columns` stays unmapped, because a timeline
  projects the fields its `timeline` config names.
- **`record:line_items`** — the composed filter is **AND-combined** with the parent
  relationship condition through `mergeFilterNodes`, never substituted for it, the
  same way `record:related_list` composes its own since objectstack#7118: a
  line-items panel is always scoped to the record it sits on, so an *additional*
  criterion can only narrow this parent's children and can never surface another
  parent's rows. `sort` becomes the load order and `limit` the row cap (default
  500). `columns` stays unmapped — here they are `GridColumn[]` driving an editable
  grid, not a field-name projection, so a view's column list would be the wrong
  *shape* rather than merely a wider answer.

**Behaviour change worth knowing about:** the timeline's default window is now a
real cap. `{ options: { $top: 100 } }` nested the limit under a key that is not a
`QueryParams` field and that no adapter in this repo reads (`convertQueryParams`
maps `params.$top`), so the intended window never reached the wire and a timeline
over a large object fetched whatever the server chose to return. It is now sent as
`$top`, and authorable via `limit` or a view's `pagination.pageSize`.

`@object-ui/core` gains `convertSortToQueryParams`, the sort→`$orderby` lowering
the three sibling blocks each inline privately. It is shared rather than copied
twice more, and is slightly more faithful to the declared contract than those
copies: a sort entry that omits `order` means ascending instead of being dropped
(the string spelling `"amount"` already meant ascending in the same copies), and
nothing orderable yields `undefined` rather than a truthy empty `{}`. Migrating
the three existing copies onto it is objectstack#7148 and is not done here.
