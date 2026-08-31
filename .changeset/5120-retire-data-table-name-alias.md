---
'@object-ui/components': minor
---

**Breaking for authored metadata:** a `data-table` column spelled `name` no
longer resolves its cells. Use the declared `accessorKey`.

`data-table`'s column normalization used to read
`accessorKey: col.accessorKey || col.name` — but `TableColumn`
(`@object-ui/types`) declares only `accessorKey`, never `name`. The declared
surface admitted one spelling while the runtime admitted two, which is the
second de-facto contract AGENTS.md #0.1 forbids. The maintainer ruling of
2026-08-20 settled the direction for the whole family: retire the consumer-side
alias, translate at the producers. `label` → `header` retired first
(objectui#5351); this retires `name` → `accessorKey` and closes the family.

**Who is affected — a column authored DIRECTLY onto a `data-table` node:**

```json
{ "type": "data-table",
  "columns": [{ "name": "email", "label": "Email" }] }   // ← was tolerated
```

becomes

```json
{ "type": "data-table",
  "columns": [{ "header": "Email", "accessorKey": "email" }] }
```

**Who is NOT affected.** Columns reaching the table through `object-data-table`,
a detail view's `related[]` list, or `object-grid` are unchanged — the adapter
never sees a legacy spelling from any of them. The reason differs by producer,
and the difference matters if you are debugging one:

- `object-data-table` and a detail view's `related[]` list **resolve** the
  legacy spelling before delivery, stamping `accessorKey` from `name` (via
  `columnIdentity`). A `name`-spelled column keeps working there.
- `object-grid` **refuses** it instead: since objectui#5068 an authored column
  must spell the declared `field`, and one that does not is dropped at intake
  and never reaches the table. Its delivered columns carry `accessorKey`
  stamped from `field`. So a `name`-spelled `object-grid` column does not
  render today either — that is objectui#5352's open question, unchanged by
  this release.

Only the directly-authored `data-table` node narrows here.

**How the break presents, so you can recognise it:** the column is not dropped
and nothing is thrown — its header still renders over blank cells, and
neighbouring columns are unaffected. If a table's header row looks right but one
column's cells are empty, check that column's key spelling first.

The two published skill guides that taught the `name` spelling
(`skills/objectui/guides/data-integration.md`, `schema-expressions.md`) migrate
in this same release, so the platform never refuses a spelling it still ships.

Graded `minor`, not `patch`: this narrows the accepted input set, which is a
breaking change for any author who used the tolerated spelling. It is not
`major` per this repo's fixed-group convention (objectui's own breaking changes
ship as `minor`; the group's major tracks `@objectstack`).
