---
'@object-ui/plugin-grid': patch
---

`object-grid` / `view:grid`'s `exportOptions` registration description now names
`streaming`, the fifth member `ObjectGrid` reads off `schema.exportOptions`
(objectui#8731). The prose previously enumerated only `formats`, `maxRecords`,
`includeHeaders` and `fileNamePrefix`, so an author reading the only authoring-facing
statement of this key's shape could not discover `streaming` — even though
`exportConfig?.streaming !== false` is a real behaviour fork (server-side streaming
vs. browser-side assembly for the export), not decoration. `ObjectGrid`'s behaviour
is unchanged; only the description text moves.
