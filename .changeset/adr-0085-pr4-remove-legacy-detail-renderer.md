---
"@object-ui/app-shell": patch
---

chore(app-shell): remove the legacy monolith detail renderer + the `renderViaSchema` kill-switch (ADR-0085 PR4, #2181)

`RecordDetailView` now always renders through the SchemaRenderer Page
pipeline (an authored `PageSchema(pageType='record')` when assigned, else
the `buildDefaultPageSchema` synthesis). The non-schema-driven monolithic
`DetailView` branch and both of its entry points are gone:

- `objectDef.detail?.renderViaSchema === false` is no longer read (it was
  the last surviving `detail.*` key — ADR-0085 removed the block from the
  spec, and the key had been kept only as this path's kill-switch);
- the `?renderViaSchema=0` debug URL param is no longer honored.

Also drops the legacy-only plumbing: the eager per-record related-lists
fan-out (`record:related_list` self-fetches lazily on the schema path)
and the intermediate `DetailViewSchema` translation layer. The
`DetailView` component itself remains in `@object-ui/plugin-detail`
(still used internally by the `record:details` renderer).
