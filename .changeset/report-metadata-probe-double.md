---
---

Test-only change to `@object-ui/plugin-report`'s `DatasetReportRenderer` suite
(objectui#5225): the dimension-metadata probe — `useDatasetDimensionMeta`'s
`GET /api/v1/meta/object/:object`, which falls back to the global `fetch` when no
`SchemaRendererProvider` is mounted — is now answered by a recording test double
instead of escaping to the real network on `127.0.0.1:3000`, and its
previously-unasserted request shape is pinned. Product code is untouched and no
published behaviour changes.
