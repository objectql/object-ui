---
'@object-ui/plugin-tree': patch
---

`ObjectTree` formats its cells the way the flat table does: a lookup column renders the
referenced record's display name and a select column renders its translated option label,
instead of a raw record id and the raw stored value (objectui#6014).

Reported against the built-in 业务单元 (`sys_business_unit`) page, whose 「组织架构」 tree tab
showed the manager column as a bare user id and the type column as `department`, while the
flat-table tab on the same page — over the same expanded records — showed the user's name
and 「部门」.

The card carried its own control, and it pointed at the fetch rather than the formatter. The
tree treated "the host passed inline `data`" as "I do not need the object schema" and skipped
`getObjectSchema`, but its record-fetch branch prefers a live object dataSource over any
inline data. On the one mount shape `ListView` actually uses — `objectName` + a dataSource +
its own pre-fetched `data` — the tree therefore issued its OWN query with
`buildExpandFields(undefined)` → `[]` → no `$expand` at all, and had no field definitions to
format cells from. Both reported symptoms fall out of that single gap, which is why the flat
tab was unaffected and why the tree's existing tests (inline data, no dataSource — a path
that never runs the tree's own fetch) could not see it.

Three changes, all inside `packages/plugin-tree`:

- The object schema is fetched whenever the dataSource can serve one, not only when no host
  passed inline data. The guard inside the fetch already no-ops without a dataSource, so the
  pure inline/static path is unaffected.
- Records are no longer fetched until that schema has settled — settled, not necessarily
  successful, so a rejected or inapplicable schema fetch can never block the tree. This also
  removes a wasted first query whose lookup columns came back as bare ids and were painted
  for a moment before the real query landed.
- Cell values route through a field-aware formatter that delegates both decisions rather than
  re-deciding them: option labels through the `translateOptions` seam `ObjectGrid` already
  uses for the flat tab (so both tabs read one `fieldOptions.*` i18n key, with the same
  exact-then-case-insensitive match and `humanizeLabel` fallback as `SelectCellRenderer`), and
  expanded references through `getRecordDisplayName`, the unified display-name resolver
  (ADR-0079), with the family judged by `isExpandableFieldType` — the same predicate that
  decided what to put in `$expand`.

No new exports and no new package dependencies: both resolvers were already published from
`@object-ui/core`, and `translateOptions` was already reachable through the `useSafeFieldLabel`
hook this component calls for its column headers.

One visible consequence beyond the report: an expanded record that comes back with no name-ish
field now reads as ADR-0079's `Record #<id>` floor — the string every other surface shows for
it — rather than as the bare id.
