---
'@object-ui/plugin-view': patch
---

`ObjectView` sends a named view's `sort` to the grid slot that can hold it — the declared sort now reaches both the header indicator and `$orderby`.

A named view's sort is an **array**: `NamedListView.sort` is
`Array< { field, order } >`, and the `views` prop declares an array too.
`ObjectView` forwarded the resolved view sort into `gridSchema.defaultSort`,
which `ObjectGridSchema` declares as a **single** `{ field, order }`. The
arity mismatch had no compile-time witness — `ObjectViewSchema.table`
collapses to a bare index signature — and both of `ObjectGrid`'s readers then
failed, in different ways:

- **The header drew nothing.** `parseSchemaSort(schemaSort ?? (schema.defaultSort
  ? [schema.defaultSort] : undefined))` re-wraps an already-array `defaultSort`
  into `[[{ field, order }]]`. Each entry must be a string or an object with a
  string `field`; a nested array is neither, so the entry was skipped and the
  parse returned `[]`. A view that arrived sorted `name desc` looked unsorted,
  and the first click on that column asked for `asc` on a list already `desc`.
- **The fetch sent nonsense.** `` `${(schema.defaultSort as any).field} ${(schema
  .defaultSort as any).order}` `` reads two absent keys off an array, so the
  request carried the literal string `"undefined undefined"` as `$orderby`.
  `serializeOrderBy` passes a non-empty string through untouched, so that
  reached the server verbatim.

The two view precedence segments (`listViews` entry, then the active `views`
entry) now ride the **canonical** `sort` slot, declared `string | SortConfig[]`
— the arity a view actually carries, and the only one of the pair that can
express a multi-key sort at all. The legacy `defaultSort` slot keeps carrying
the `table` segment alone and is read exactly as before.

**Precedence is unchanged.** `ObjectGrid` resolves `sort ?? defaultSort`, so a
view sort still outranks both `table.sort` and `table.defaultSort`, and a
`table.sort` still outranks a `table.defaultSort` — the same order the non-grid
fetch and the delegated `renderListView` schema already express. A view that
supplies no sort forwards exactly what it forwarded before.

This is also the shape the shared sort sink accepts (`convertSortToQueryParams`
takes `string | SortConfig[]`), so the fix converges on the normalized dialect
rather than adding another spelling for the sort-sink convergence work to fold
in later.
