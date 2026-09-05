---
'@object-ui/types': minor
---

`DrillDownConfigSchema` is the zod mirror of `DrillDownConfig`, and both
declarations that carry `drillDown` reference it — `ChartSchema`
(`zod/data-display.zod.ts`) and `ObjectDataTableSchema` (`zod/objectql.zod.ts`)
— so the published validator under `@object-ui/types/zod` reads the key for the
first time (objectui#7352).

`DrillDownConfig` has been declared on the TypeScript face since objectui#6058
seeded the parity ledger, and objectui#6576 declared it on a second type. No zod
mirror existed, so under `BaseSchema`'s `.passthrough()` a
`drillDown: { enabled: 'yes' }` parsed green and rode through to a widget that
reads `enabled` as truthy — `declared !== enforced` on a published surface.

Accept-set change on the published validator, stated plainly:

- NARROWS: a `drillDown` whose declared key holds a value outside its declared
  type (`enabled: 'yes'`, `mode: 'jump'`, `maxRows: '50'`, `report: 'pipeline'`)
  is now refused BY NAME on a `chart` or `object-data-table` node, where it
  previously rode through untouched.
- Unchanged: every value the TypeScript declares still validates, including the
  `{ enabled: true }` / `{ enabled: true, mode: 'record' }` blocks the dashboard
  renderer synthesises, `report`'s two structural forms, and an inline report's
  extra keys (the declaration's index signature is `.catchall(z.unknown())`).
- Output shape, worth knowing before you read a parsed `drillDown.report`: the
  member is a union, and its two arms differ in what they KEEP. The inline arm
  carries the declaration's index signature as `.catchall(z.unknown())`, so extra
  report keys survive; the named-reference arm is a plain object, so a value that
  reaches it keeps only `name` (`{ name: 'x', columns: [] }` is accepted, and
  parses to `{ name: 'x' }`). Both were accepted and unvalidated before, and
  neither is refused now.
- Unchanged: `PivotTableSchema.drillDown` has no zod mirror at all, and
  `DataTableSchema` declares the key on neither face — both are untouched here.
- New export on `@object-ui/types/zod`: `DrillDownConfigSchema`.

`DrillDownConfigSchema` is deliberately NOT `@objectstack/spec/ui`'s
`ChartDrillDownSchema`: that object models the chart-only subset strictly and
refuses `mode` and `report` by name, both of which are live keys on the table /
pivot / metric widgets that share `DrillDownConfig`.
