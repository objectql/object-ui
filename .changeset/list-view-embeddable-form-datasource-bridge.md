---
"@object-ui/plugin-list": patch
"@object-ui/plugin-form": patch
---

`list-view` and `embeddable-form` get a data source on the registry path — their required `objectName` was binding to nothing (#3144).

`SchemaRenderer` puts the data source on `SchemaRendererContext` and **never** injects it into
component props. A component that reads `props.dataSource` therefore needs its registration to
bridge the two. `object-form`, `object-kanban` and `object-calendar` each register a small
renderer that does exactly that. These two did not:

- `list-view` (and its `view:list` alias) registered the bare `ListView`, which reads
  `props.dataSource` — so its `getObjectSchema` effect returned immediately, nothing was ever
  fetched, and it rendered the `empty-state` "Nothing here".
- `embeddable-form`'s renderer was `({ schema }) => <EmbeddableForm config={schema} />`, dropping
  the context entirely — so the read-only source it derives for its inner `ObjectForm` was never
  built, and its submit path (`if (dataSource) await dataSource.create(...)`) had nothing to call.

Both declare `objectName` **required** in their registry `inputs`. A binding the protocol obliges
an author to supply, that nothing on that path can consume, is objectstack#4413's shape one layer
up — and the reason it went unnoticed is that the console never takes this path: it reaches
ListView through `ObjectView`'s `renderListView` render-prop, which passes a data source itself.
Broken on the registry/SDUI path, which is the path `sdui.manifest.json` describes and a
`kind:'react'` page walks.

Found by `apps/console/src/__tests__/public-block-binding-reach.test.tsx` (objectstack#4472), not
by hand — that suite mounts every public block declaring an `objectName` under a recording
`dataSource` and asserts the binding arrives. Its ledger carried these two as named debt; with the
bridge in place the ledger's both-directions assertion **failed until the entries were deleted**,
which is the mechanism working as designed. Only `record:related_list` remains, and legitimately
(it needs a parent record id from `RecordContext` before it may fetch).

An explicit `dataSource` prop still wins, so hosts passing their own are unaffected, and
`ListViewRenderer` forwards refs so `ListViewHandle` still works through the registry.
