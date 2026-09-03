---
'@object-ui/types': patch
---

Repair the `object-map` and `object-gantt` mirrors: `objectName` is optional,
and a refinement requires that at least one of `data`, `staticData`,
`objectName` is present (objectui#6939, maintainer ruling recorded 2026-09-02 —
this is one of the eight groups on that card, dispatched as its own PR per the
ruling).

Both renderers resolve their records from one of three keys, in this order —
`getDataConfig` in `plugin-map/src/ObjectMap.tsx` and
`plugin-gantt/src/ObjectGantt.tsx`: `data`, then `staticData`, then
`objectName`. Both mirrors required `objectName` alone, so a document authored
on `staticData` drew correctly and was refused by `safeValidateSchema` — six
catalog entries, three per component.

- **`object-map`** / **`object-gantt`**: `objectName` becomes optional on the
  mirror and on the TypeScript twin in the same stroke, and each member ends in
  `requireRecordSource`, whose issue sits at the root path, carries
  `params.code = 'RECORD_SOURCE_REQUIRED'` and names the three keys an author
  can supply.
- **`object-gantt`** additionally declares `data` (as `ViewDataSchema`, the
  spelling `object-map` already used): it is the FIRST key that resolver reads
  and was undeclared on both faces, which would have left the refinement naming
  a key the validator had never heard of.

**patch, not minor: the accept set only widens toward what already renders.**
Every document that validated before still validates — `objectName` alone,
including an empty one, still parses, because presence is `!== undefined` and
not the renderer's truthiness. The one shape the refinement refuses (none of
the three) was refused before too, when `objectName` was required. Documents
the renderers already draw start validating.
