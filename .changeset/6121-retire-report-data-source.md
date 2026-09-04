---
'@object-ui/types': minor
---

The two report data-source keys are retired on both faces (objectui#6121,
maintainer ruling of 2026-08-30, decision batch #8 — option A's retirement half;
ADR-0049 enforce-or-remove).

**The accept set of a published validator moves** (`@object-ui/types/zod`):

- `ReportComponentSchema.dataSource` was `z.any().optional()`, so any JSON value
  parsed green and was then read by nobody.
- `ReportBuilderSchema.dataSources` was `z.array(z.any()).optional()`, on a node
  type no renderer is registered for at all.

Both now carry `retirementTombstone(...)`: an authored value is refused at the
key's own path with `code: 'invalid_type'` and a message that names the key, says
why it is retired and points at the spelling that runs. Nothing that used to be
refused parses green.

**The TypeScript face** — both keys become `?: never` rather than being deleted,
so an author who still writes one gets a `tsc` error at the authoring site
instead of a silently stripped key. They were annotated `DataSource` /
`DataSource[]`, the runtime ADAPTER interface (`find(resource, params)`), which
no JSON document can author; that mis-annotation is the defect objectui#6121 was
filed for, since every example on `content/docs/core/report-schema.mdx` authored
a config object against it.

**Why this is a retirement and not a rename.** No read site consumed either key:
`@object-ui/plugin-report`'s `ReportRenderer` takes its adapter as a React prop
or from `SchemaRendererContext`, never off `schema.dataSource`, and the live
9.0 path binds a semantic-layer `dataset` (ADR-0021). Authored occurrences
measured zero in this repo and in the sibling `objectstack` checkout, whose
report metadata binds `dataset` throughout — the ruling's own deprecation-window
exit criterion. A stored document that still carries the key now fails loudly at
`safeParse` instead of being accepted and ignored; drop the key, and bind the
report through `dataset`.

The replacement binding key the ruling names (`data?: ViewData`) is deliberately
NOT declared here, and is escalated on objectui#6121: `data` is already a live
key on `ReportComponentSchema` — the report ROW array, read by
`LegacyReportRenderer` as `data.length` / `data.map` — so declaring the binding
under that name would put two authoring contracts on one key inside one
renderer.

Pinned in `packages/types/src/__tests__/report-schema-authoring-face.test.ts`:
the `never` twins, the named refusals with their issue envelope, the `.describe()`
metadata channel, and controls that a report without the key still parses.
