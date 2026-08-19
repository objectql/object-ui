---
"@object-ui/plugin-dashboard": minor
---

fix(plugin-dashboard): `ObjectDataTable` resolves column identity before it hands columns to the table

`normalizeColumns` converted the `string[]` shorthand and returned every object
column **raw**. `data-table` is an adapter, and its column key is `accessorKey`
(`TableColumn.accessorKey`) — a key `@object-ui/core` deliberately holds outside
the metadata identity fold, where `column-identity.ts` names it
`TABLE_ADAPTER_COLUMN_KEY`. So a column authored in the spec-canonical spelling,
`{ field: 'stage' }`, reached the adapter carrying no `accessorKey` at all: the
widget rendered a header over `row[undefined]` — every cell blank, nothing said
— and `computeLookupExpand`'s `$expand` whitelist, which resolved
`c.accessorKey || c.name`, missed the same column, so a `field`-spelled lookup
also lost its related record and showed a raw FK id.

Identity is now resolved once, here, through the shared `columnIdentity` reader
and stamped onto the adapter's key. This is the move objectui#5022 made in
`RelatedList` and objectui#5068 generalized in `ObjectGrid`: metadata vocabulary
in, adapter vocabulary out, one translation in one place.

**Affected input.** A column authored `{ field: … }` on an `object-data-table`
now renders its cells and, when the field is relational, enters `$expand`. Both
were previously empty. Columns authored `{ accessorKey: … }` are untouched, by
reference. An author-supplied `accessorKey` is never overwritten — a deliberate
divergence between the table slot and the metadata key belongs to the author —
and an entry whose identity resolves to nothing is returned untouched, so
nothing is invented for it.

The other half of objectui#5120 — retiring `data-table`'s undeclared `col.name`
alias — is **not** in this change. The card's census-first fork clause tripped:
`skills/objectui/guides/data-integration.md` and
`skills/objectui/guides/schema-expressions.md` both instruct authors to spell a
`data-table` column `{ "name": …, "label": … }`, so the limb has real authorized
usage and the deletion went back to the maintainer. This change is a
prerequisite for that deletion rather than a substitute: it is what stops
`object-data-table` from depending on the alias.
