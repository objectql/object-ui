---
'@object-ui/plugin-grid': patch
---

Grid: a malformed entry in `grouping.fields[]` no longer crashes the whole grid.

A `null` (or `undefined`) hole in the array was dereferenced with no guard at
two places — `ObjectGrid`'s `groupValueFormatter` memo and `useGroupedData`'s
`buildLevel` — throwing `TypeError: Cannot read properties of null (reading
'field')` during render, before any projection was built. Both sites now read
one normalized entry list, admitting exactly the entries `collectGroupingFieldRefs`
harvests into the query projection, so the usable grouping levels still group
and an unusable entry is simply dropped rather than taking the view down.
