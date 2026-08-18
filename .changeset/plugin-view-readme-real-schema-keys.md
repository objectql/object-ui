---
'@object-ui/plugin-view': patch
---

The plugin-view README now documents the keys `ObjectView` actually reads, so a
copied example renders instead of coming up empty.

Every untyped schema literal in the README was written against a key vocabulary
`ObjectViewSchema` does not declare and `ObjectView` does not read. The object
name was spelled `object` — the real key is `objectName`, and it is the only
required key besides `type` — so a copied example left the component with no
object to query. Three "view modes" were organized around a `viewMode` key that
exists nowhere, and `fields`, `mode`, `recordId`, `fieldConfig`, `nestedFields`,
`tabs`, `searchable`, `sortable`, `filters` and `enableDelete` were documented
the same way. None of it failed loudly: `ObjectViewSchema` extends a base schema
carrying a `[key: string]: any` index signature, so excess-property checking is
defeated on this type, and the blocks carried no type annotation to trip even
the one assertion that does bite.

The thirteen affected blocks are rewritten against the declared surface, each
one measured against the renderer before being written: `defaultViewType` (plus
`listViews` / `defaultListView`) for the list type, `layout` with its
drawer/modal/page record surface for what the README called form and detail
views, `table` and `form` for grid and form configuration, `operations`
booleans and `onNavigate` in place of the `onCreate` / `onUpdate` / `onDelete` /
`onSubmit` callbacks that were never part of this contract, and the `show*`
toolbar toggles. Examples now carry `ObjectViewSchema` annotations, which makes
a missing `objectName` a compile error in all fifteen of them.

Three structural facts are stated outright rather than left to be inferred:
`dataSource` is a required prop of `ObjectViewProps` and not a schema key, so
putting it in the schema does nothing; create/edit/read are internal states of
one record surface rather than authored modes, which is why `ObjectViewSchema`
omits `mode` from its `form` block; and `ObjectView` forwards a fixed list of
keys out of `table` and `form` rather than passing those objects through, so the
README now names exactly which ones — including that page size is `table.pageSize`
on this path, the spelling the component forwards.

The `ViewSwitcher`, `FilterUI` and `SortUI` sections are untouched: their keys
were checked against the registered `inputs` and already matched.
