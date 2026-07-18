---
"@object-ui/app-shell": minor
---

feat(studio): filter editor for roll-up `summary` fields (framework#1868)

The object-designer field inspector now edits `summaryOperations.filter` on a
`summary` field. Backing the framework's new filtered roll-ups — where one child
object feeds several parent totals, each aggregating only the child rows a
predicate matches (an approved-only sum vs the grand total) — the inspector adds
a structured field/operator/value row editor under Rollup Options (mirroring the
lookupFilters editor), reading and writing the spec's FilterCondition object.

- Values are coerced to the child field's stored type, so a `boolean` field emits
  `{ billable: true }` (not the string `"true"`) and a numeric operator emits
  `{ amount: { $gte: 500 } }` — the FilterCondition then matches the real column.
- Rows map to/from the flat FilterCondition (and a top-level `$and`); a filter
  using logic the rows can't represent (`$or` / nested) is shown read-only with a
  note instead of being clobbered on edit.
- New `designer.field.summary.filter*` i18n keys (en + zh-CN).
