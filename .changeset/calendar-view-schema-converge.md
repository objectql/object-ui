---
'@object-ui/types': minor
'@object-ui/plugin-calendar': patch
---

`CalendarViewSchema` (TS interface and zod mirror) converges on the registered
`calendar-view` renderer's measured read set (objectui#5667, maintainer ruling
option A — the renderer is authoritative).

**Breaking for consumers of the published type** (deliberate; per-repo policy
breaking changes ship as `minor` — the fixed group's `major` tracks
`@objectstack`):

- Nine inert keys are retired: `events` (the interface's only required key,
  which the renderer deliberately drops — objectui#4433), `defaultView`,
  `defaultDate`, `date`, `views`, `editable`, `onEventCreate`,
  `onEventUpdate`, `onDateChange`. None had a read site on the authored-node
  path and no measured app authors them (ADR-0049 enforce-or-remove).
- The type now declares what the renderer actually reads: `data`, `titleField`,
  `startDateField`, `endDateField`, `allDayField`, `colorField`, `view`,
  `currentDate`, `allowCreate`, `className`, plus the two host-only function
  hatches it forwards (`onEventClick`, `onViewChange`).
- Practical radius, measured: `BaseSchema` carries an index signature and the
  zod `BaseSchema` is `.passthrough()`, so nodes still authoring retired keys
  neither fail to compile nor get rejected at validation — they are simply no
  longer declared, documented, or type-checked. The material accept change is
  that zod no longer **requires** `events`: a `{ "type": "calendar-view" }`
  node without it now validates (previously the one key validation demanded
  was the one key guaranteed to do nothing).

Runtime renderer behaviour is unchanged. `@object-ui/plugin-calendar`'s README
and `content/docs/api/schema-reference.md` are repaired to the converged
surface in the same change, so no copy of the old contradiction survives.
