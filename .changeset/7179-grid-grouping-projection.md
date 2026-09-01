---
'@object-ui/core': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-list': patch
---

Fix: a grid grouped by a field it does not also show as a column no longer collapses
every row into one `(empty)` group (objectui#7179).

`$select` was built from the view's `columns` and nothing else, so a view declaring
`grouping: { fields: [{ field: 'business_unit' }] }` on a field absent from its columns
never asked the server for that field. It was `undefined` on every row by the time
grouping ran, and the grouping label builder — correctly, for a genuinely empty value —
answered `(empty)` for all of them. The result was one collapsible group holding every
record, with no error, no warning and no empty state: a grid that looked like it grouped
and did not, reading as "these records have no value for this field".

The grouping fields are now unioned into the projection, at both places it is built —
`ObjectGrid` when it fetches for itself, and `ListView` when it fetches and hands the
rows down. Lookup grouping fields are unioned into `$expand` as well: a `select` that
fetches a bare foreign key without populating it buckets by raw id instead of by name,
which is a different wrong answer rather than a fix.

Authors do not need to mirror a grouping field in `columns` any more. That was never
required by `@objectstack/spec` — `grouping` is a sibling of `columns`, not a subset of
it — and the neighbouring view kinds (kanban, gantt, timeline) already unioned their
`groupByField` with no column needed. Refusing the configuration at author time was
considered and rejected: it would make the grid the odd one out and reject working
intent that the schema explicitly allows.

The union is guarded, and the guard is as load-bearing as the fix. A `grouping.fields[]`
entry carries a bare string that has never been through column validation, and some
backends answer an unknown `$select` key with an empty result set rather than ignoring
it. Unioned unguarded, a grouping field naming something the object does not declare
would have turned this bug into a strictly worse one — no rows at all, equally silently.
Grouping fields are therefore intersected with the object's declared fields and passed
through the same field-level-security gate as columns and predicate operands before they
reach the query.
