---
---

Docs and catalog fixtures only, no published package source touched: the two `plugin-form`
catalog entries are now real `object-form` nodes instead of hand-built `form` schemas.
`content/docs/plugins/plugin-form.mdx` mounted `basic-form` and `contact-form` under
`PluginLoader plugins={['form']}` while both authored a root `type: "form"` with `input` /
`select` / `checkbox` / `textarea` fields — every one of those registered by
`@object-ui/components`, none of them by `@object-ui/plugin-form`, whose own keys are
`object-form`, `embeddable-form`, `form-analytics`, `object-master-detail-form`,
`record:line_items` and `view:form`. They are replaced by `object-form-record` (one `users`
record, fields derived from the object's metadata, `fields` / `columns` shaping the grid)
and `object-form-tabbed-sections` (the same record with `formType: 'tabbed'`, so the
declared `sections` become tab panels of one form).

The two hand-built forms are legitimate `@object-ui/components` examples filed under the
wrong plugin, so they are re-seated into `components-form-form` as `basic-form` and
`demo-request-form` rather than deleted — deleting a catalog entry moves corpus-wide
counters (`NODE_CENSUS` in `layout-dom-leak-5574.test.tsx` and in
`form-control-dom-leak-5632.test.tsx`, and the `className`-carrying layout node and `stack`
node floors in `layout-props-conversion.test.tsx`), and a counter that moves because a
fixture was deleted is indistinguishable later from one that moved because coverage
regressed. All of them are unchanged, with no floor edited.

`apps/site/app/components/registerCatalogBlocks.ts` now declares `@object-ui/plugin-form`,
and its header no longer claims the import list is "exactly the packages that census
resolves to". The two `OWN_PLUGIN_DEBT` lines in `catalog-gallery-render.test.tsx` are
deleted, so both entries are held to the pin like every other one, and the pin's
provenance instrument now reads the fixture record out of a form control's value as well as
out of the tile's text — a form puts its record in `input.value`, where `textContent`
cannot see it.
