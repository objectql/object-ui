---
"@object-ui/core": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-tree": patch
---

fix(list,grid,detail,tree,core): every column resolver reads one key (#3104 PR2)

PR1 (#3119) put a canonicalizing fold at ListView's ingestion boundary. This
converges the 22 read sites themselves onto `columnIdentity()` from
`@object-ui/core`, so a surface that is NOT downstream of that fold resolves
the same identity anyway.

That distinction is the user-visible part. A standalone `object-grid` node —
authored directly on a page, with no `list-view` above it — never passed
through `normalizeListViewSchema`. Its `getSelectFields` read `c.field` alone
while the `ensureId` probe one line above read `f?.name || f?.field`, so a
legacy `{ name: 'account' }` column reached `$select` as a literal `undefined`
hole: the server never returned the field and every cell in that column came
back empty. Same for `ObjectTree`, `RelatedList` and the `record:details` /
`record:related_list` renderers.

Converged:

| Surface | Was | Now |
|---|---|---|
| `ListView` ×9 + its 2 request builders | `name \|\| fieldName \|\| field` vs `f?.field` | `columnIdentity()` |
| `RelatedList` ×8 | `accessorKey \|\| field \|\| name` | `accessorKey \|\| columnIdentity()` |
| `ObjectGrid` | name-first probe vs `c.field` projection | `columnIdentity()` |
| `ObjectTree` | `name \|\| fieldName \|\| field \|\| key` | `columnIdentity() \|\| key` |
| `buildExpandFields` | `field ?? name ?? fieldName` | `columnIdentity()` |
| `record-details` / `record-related-list` | `field \|\| name (\|\| key)` | `columnIdentity() (\|\| key)` |

`accessorKey` keeps its precedence in `RelatedList` — it is TanStack Table's
column key, not ObjectStack metadata identity, and only the `field || name`
tail was converged. `key` stays a tail fallback in `ObjectTree` and
`record-related-list` for the same reason: it is a generic entry key.

Two incidental fixes that TypeScript surfaced once the resolver stopped
returning `any`: ListView's filter-field options and its hide-fields popover
both built entries keyed `undefined` for a column with no resolvable identity.
Those entries could never match a column; they are now dropped.

**Inventory re-triage.** PR1 recorded 24 family members. Two were mis-classified
and are reclassified here rather than converged — reading what they actually
feed shows they are not column reads at all:

- `ViewPreview.tsx` adapts a ViewItem **form** section to what `object-form`
  selects by (`field` → `name`) — the #3090 two-layer join.
- `SchemaForm.tsx` renders an arbitrary metadata **array** into a popover
  summary and guesses at a display key; the entries are validations, actions,
  or whatever the JSON schema declares.

So the family was 22, and it is now **0**. The ratchet asserts that, asserts
each converged surface actually routes through the shared reader (a surface
that dropped identity resolution instead of converging it goes red), and pins
`accessorKey`'s precedence in `RelatedList`.
