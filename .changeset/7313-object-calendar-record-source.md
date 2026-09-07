---
'@object-ui/types': minor
---

`ObjectCalendarSchema` declares the record-source ladder its renderer already
reads — `data`, `staticData`, `objectName` — on both faces, in the shape
objectui#6939 landed on `object-map` and `object-gantt` (objectui#7313).

`ObjectCalendar` resolves its records through the shared ladder
(`resolveRecordSourceConfig` in `@object-ui/core`, called from
`plugin-calendar/src/ObjectCalendar.tsx`): `data` first, then `staticData`,
then `objectName`. The published TypeScript interface REQUIRED `objectName` and
declared neither `data` nor `staticData`; the published Zod mirror did the same.
So an `object-calendar` node authored on `staticData` — the route the plugin
page documents twice — rendered correctly and was refused by
`safeValidateSchema`, and could not be annotated with its own type
(`TS2741: Property 'objectName' is missing`).

- `objectName` becomes optional on the TypeScript interface and on the mirror
  in the same stroke; it stays the object-provider key.
- `data` (`ViewData` / `ViewDataSchema`) and `staticData` (`any[]`) are
  declared on both faces, spelled exactly as `ObjectGanttSchema` spells them.
- The member ends in `requireRecordSource('object-calendar')`: a node
  authoring NONE of the three is refused by name — one root-level issue,
  `params.code = 'RECORD_SOURCE_REQUIRED'`, the map/gantt message naming
  `data`, `staticData` and `objectName` — instead of by a missing `objectName`.

**A widening.** A node authoring `staticData` or `data` without `objectName`
now validates (it always rendered — the read is
`resolveRecordSourceConfig(schema)`, keyed on the three). Every document that
validated before still validates: `objectName` alone still parses, an empty
one included, because presence is `!== undefined`. The one shape the
refinement refuses (none of the three) was refused before too, at
`objectName`. The two static-data examples in
`content/docs/plugins/plugin-calendar.mdx` are now annotated
`ObjectCalendarSchema` and compile under the doc-snippet gate.
