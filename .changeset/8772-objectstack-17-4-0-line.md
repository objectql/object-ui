---
'@object-ui/types': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-gantt': minor
'@object-ui/plugin-kanban': minor
'@object-ui/components': minor
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Take the `@objectstack/*` line to 17.4.0 and follow every contract it moved
(objectui#8772, with #7783 · #7663 · #8172 · #7845 · #8785).

**Breaking on one authored key, deliberately.** A dashboard node's
`refreshInterval` is now `refreshIntervalSeconds` — the value is unchanged
(seconds), and the spec refuses the old spelling by name with a message naming
the new one, so an existing document fails loudly at parse rather than silently
losing its auto-refresh. `os migrate meta --from 17` lists the mechanical edits.
The report component's own `refreshInterval` is a different key and is NOT
affected. (Scored `minor`, not `major`: this repo's fixed group tracks the
`@objectstack` major — AGENTS.md §版本号策略.)

Also authored-surface changes, all following a published spec move rather than a
local decision:

- `element:record_picker`'s `filter` input is now the `ViewFilterRule` array
  form `[{ field, operator, value }, …]`. The MongoDB-style record form is
  refused by the contract (objectstack#14406 converged the last record-form
  `filter` in the map), so a JSX page writing the array form no longer draws a
  false `type-mismatch` and one writing the record form is told.
- `object-kanban` now publishes `limit`, the row cap its renderer has always
  lowered to `$top`. The spec declares it as of objectstack#16503, so the key
  the docs teach is finally one the save gate stores.
- `object-gantt`'s ten extension keys (`timeSegments`, `interactions`,
  `lockField`, …) are derived from the spec's `GanttConfigSchema` instead of
  being re-declared locally. Same accept set on the flat face; the nested
  `gantt` block narrows to the spec's, which now refuses an undeclared sub-key
  by name where its `.passthrough()` window used to admit one.
- The console's preview-gallery samples — the worked examples an author copies —
  move with two spec changes of their own: a job's `timeout` is now `timeoutMs`
  (same unit-in-the-key-name ruling as the dashboard key above), and a flow's
  end node writes `outcome: 'completed'`, the enum having narrowed to
  `completed | refused`.
