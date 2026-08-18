---
'@object-ui/plugin-view': patch
---

The plugin-view documentation-site page now teaches the keys `ObjectView`
actually reads, so a copied example renders instead of coming up empty.

`content/docs/plugins/plugin-view.mdx` carried the same fictional key surface
the README did before it was rewritten: the object name was spelled `object`
(the real key is `objectName`, the only required one besides `type`), the page
was organised around a `viewMode` trichotomy that does not exist, and
`fields` / `mode` / `recordId` / `fieldConfig` / `nestedFields` / `tabs` /
`filters` / `searchable` / `enableDelete` went with it. None of those is a
declared member of `ObjectViewSchema`, and none is read anywhere in
`packages/plugin-view/src`. Because `type: 'object-view'` is genuinely
registered, a copied example still resolved to a renderer — it just never
received an `objectName`, and the component's data effects are all guarded on
it, so the reader got a silent empty view rather than an error.

The Schema API section and every example after it were rewritten against the
declared surface, with each key measured against the renderer's read points
before being written: `defaultViewType` (plus `listViews` / `defaultListView`)
for the list type, `layout` and its drawer/modal/page record surface in place of
the separate "form view" and "detail view" narratives, `table` and `form` for
grid and form configuration, `operations` booleans and `onNavigate` in place of
the `onCreate` / `onUpdate` / `onDelete` callbacks that were never part of this
contract, and the `show*` toolbar toggles. The examples are now typed
`ObjectViewSchema` blocks rather than untyped JSON, which makes a missing
`objectName` a compile error in all fourteen of them — the page previously had
no assertion at all, since `ObjectViewSchema` inherits an index signature from
`BaseSchema` that accepts any undeclared key.

Three structural facts are stated outright: `dataSource` is a required prop of
`ObjectViewProps` and not a schema key; create, edit and read are internal
states of one record surface rather than authored modes; and `ObjectView`
forwards a fixed list of keys out of `table` and `form` rather than passing
those objects through, so the page names exactly which ones — including that
page size on this path is `table.pageSize`, not `table.pagination`.

The TypeScript Support snippet's `import type { ObjectViewSchema }` also moves
from `@object-ui/plugin-view`, which does not export it, to `@object-ui/types`,
where it is declared. Copying the old line produced a TS2305.
