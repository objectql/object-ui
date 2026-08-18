---
'@object-ui/plugin-report': patch
---

docs(plugin-report): teach the dataset-bound report as the sole authoring shape

`packages/plugin-report/README.md` and `content/docs/plugins/plugin-report.mdx`
still taught the pre-9.0 query form (`objectName` + column-definition `columns` +
`groupingsDown` / `groupingsAcross`) as the live way to write a report, and named
three renderers plus `applyInMemoryAggregation` that were removed at the ADR-0021
cutover. The current `ReportSchema` is strict and rejects that form outright, so
every copyable example on both pages now authors the dataset-bound shape
(`dataset` + `rows` / `columns` / `values`, `runtimeFilter`, `order`, `drilldown`,
`chart`) through `defineReport`. Stored pre-9.0 documents keep one clearly
labelled migration-only section describing the lossy bridge that renders them and
the key-by-key direction of migration.
