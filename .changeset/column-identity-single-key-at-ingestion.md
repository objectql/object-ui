---
"@object-ui/core": minor
---

feat(core): one column identity per column — `field` stamped at ingestion (#3104)

A column's field identity was resolved twice, with two different precedences
over the same `schema.columns` array, and the two halves disagreed:

- **request path** — `ListView`'s `$expand` and `$select` builders, and
  `ObjectGrid.getSelectFields`, read `f?.field` and only `f?.field`.
- **render path** — the FLS gate, the hidden-field filter, `fieldOrder`, both
  export branches and the hide-fields popover read
  `f.name || f.fieldName || f.field` — name FIRST.

So `{ field: 'account', name: 'account_name' }` fetched `account` while the
renderer keyed off `account_name`, and `{ name: 'account' }` rendered a column
the request dropped entirely — neither `$select` nor `$expand` carried it. That
is the mechanism behind the "relation column shows a bare id / column is empty
/ sort does nothing / export is missing a column" defect class.

Per AGENTS.md #0.1 the fix is not another `?? name` at the read sites. Legacy
acceptance moves to the one boundary that already folds this view's vocabulary,
`normalizeListViewSchema`, which now also canonicalizes each column's identity.

New in `@object-ui/core`:

- `columnIdentity(entry)` — the single reader. Resolves `field` → `name` →
  `fieldName`, canonical-first, so it agrees with `buildExpandFields` instead
  of racing it. Handles bare-string columns.
- `normalizeColumnIdentity(entry)` / `normalizeColumnIdentities(columns)` — the
  fold. Stamps `field`; a legacy key that is **already present** is mirrored
  onto the same identity so name-first readers resolve what the request asked
  for; a legacy key that is **absent is never invented**, and an
  already-canonical column is returned by reference.
- `hasConflictingColumnIdentity(entry)` — true when a column's keys disagree.
- `CANONICAL_COLUMN_IDENTITY_KEY`, `LEGACY_COLUMN_IDENTITY_KEYS`,
  `TABLE_ADAPTER_COLUMN_KEY`.

The fold **mirrors** rather than deleting the legacy key, unlike the other
folds in `normalizeListViewSchema`. Deleting would work inside this repo (every
name-first read falls through to `field`), but `columns` entries cross the
package boundary into host renderers and dropping `name` from under them is a
breaking change with no inventory. Deletion is a later call, once the in-repo
consumers read `columnIdentity()`.

Behaviour is unchanged for any column carrying a single identity key — every
read site resolves the same string it did before. The entries whose resolution
moves are exactly the ones where two sites already disagreed.

`accessorKey` is deliberately untouched: it is TanStack Table's own column key
(`TableColumn.accessorKey`), not ObjectStack metadata identity, and folding
across that boundary would fossilize the merge.
