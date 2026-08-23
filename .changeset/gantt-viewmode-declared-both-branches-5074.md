---
'@object-ui/types': minor
'@object-ui/plugin-gantt': minor
---

**`viewMode` is now declared authoring surface on `ObjectGanttSchema`, and both
gantt renderer branches honour it** (objectui#5074, maintainer ruling
2026-08-19: declare-and-wire; the spec half landed first upstream).

- `ObjectGanttSchema` (TS interface and zod mirror) declares `viewMode`,
  DERIVED from the pinned `@objectstack/spec` `GanttConfigSchema.viewMode`
  enum by reference, so the member list cannot drift. Deliberately no
  default: an omitted `viewMode` keeps letting a persisted layout
  (`persistLayoutKey`) seed the timeline granularity before the renderer's
  `'day'` fallback.
- The timeline branch (`GanttView`) now receives an authored `viewMode`.
  Previously only the resource-workload branch (`resourceView` +
  `assigneeField`) honoured it, so `viewMode: 'month'` on an ordinary gantt
  view was silently ignored.
- The `(schema as any).viewMode` cast in `ObjectGantt` is retired; both
  branches read the declared `ganttConfig.viewMode`, which also honours the
  key when authored inside the spec's `gantt` config block.
- Accept-set note: `viewMode` is now a DECLARED key, so an off-enum value
  (e.g. `viewMode: 'hour'`) becomes a zod validation error where it
  previously passed through unvalidated. Values on the published spec enum
  are unaffected.
