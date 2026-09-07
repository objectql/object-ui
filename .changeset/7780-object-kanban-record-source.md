---
'@object-ui/types': minor
---

`ObjectKanbanSchema.objectName` becomes a PRESENCE RULE on both faces — at least one of
`bind`, `data`, `objectName` (objectui#7780).

`packages/plugin-kanban/src/ObjectKanban.tsx` resolves a board's rows in four steps: the
pre-fetched `data` PROP a parent passes (`hasExternalData`), then `bind` through
`useDataScope(schema.bind)`, then the inline ROW ARRAY on `schema.data`, and only then a
fetch keyed by `schema.objectName` — `rawData = (hasExternalData ? externalData :
undefined) || boundData || schema.data || fetchedData`, with the fetch itself gated on
`schema.objectName && !boundData && !schema.data`. Every `objectName` read is guarded.
Both published faces nevertheless REQUIRED `objectName`, so a `bind`-only or `data`-only
board — one that renders correctly today — was refused by the shipped validator and could
not be annotated with its own type.

**The accept set moves in one direction only.** Measured from source on `origin/main`
`fff250ff` and on this branch, both entry paths (`ObjectKanbanSchema.safeParse` and the
published `safeValidateSchema`), against a rebuilt `dist`:

| document (all carry `groupBy`) | before | after |
| --- | --- | --- |
| `bind` only | refused at `objectName` (`invalid_type`) | **accepted** |
| `data` only (raw rows) | refused at `objectName` (`invalid_type`) | **accepted** |
| `objectName` only | accepted | accepted |
| `objectName: ''` | accepted | accepted |
| none of the three | refused at `objectName` | refused **on the refinement** (`RECORD_SOURCE_REQUIRED`, root path) |

Nothing went from accepted to refused. Presence is `!== undefined`, matching the sibling
predicate's wording rather than the renderer's truthiness, so an empty `objectName: ''`
keeps validating.

**⚠️ Not the map / gantt / calendar ladder, and deliberately not built on it.** Those
three (objectui#6939, objectui#7313) resolve `data` as a `ViewData` PROVIDER BLOCK →
`staticData` → `objectName` through the shared `resolveRecordSourceConfig`, refined by
`requireRecordSource`. This board has **no** `staticData` rung, reads `data` as a **raw row
array** directly, **has** a `bind` rung the other three never walk, and calls
`getDataConfig` / `resolveRecordSourceConfig` **zero** times. The two key sets are neither
equal nor nested, so the predicate is a new one — `requireKanbanRecordSource` — and the
shared one is untouched.

**objectui#7651 is a prior ruling and it holds.** It was ruled B and closed `not_planned`
on 2026-09-05, refusing a sixth `getDataConfig` producer, a `ViewData` retype of the
board's `data`, and a `staticData` rung; its epitaph is in the tree on
`KanbanSchema.data`. Nothing here adds a rung. `data` and `bind` stay INHERITED from
`BaseSchema` rather than re-declared on this member, and the new pin asserts that by
IDENTITY (`shape.data === BaseSchema.shape.data`) rather than by membership, because
membership cannot tell inherited from re-declared.

**`groupBy` is untouched and stays REQUIRED** (objectui#7322, PR #7774). A record source
and a lane key are different questions: every lane-less document above is still refused at
`groupBy`, and the two readings PR #7774 excluded from counting as a lane-less mode — the
`dataSource` json fragment in `content/docs/utilities/data-objectstack.mdx` and
`ListView.tsx`'s runtime-generated node — are asserted still-refused in the new pin. The
retired `groupField` tombstone is likewise still refused by name.

Landed on both faces per the zod-mirror-parity pairing: `objectName?: string` on the
`ObjectKanbanSchema` interface in `@object-ui/types`, `z.string().optional()` plus
`.superRefine(requireKanbanRecordSource)` on its mirror in `@object-ui/types/zod`. The key
sets are unchanged on both sides, so no parity ledger row and none of the objectui#7279
header figures move. `object-calendar-record-source-7313.test.ts` loses the
`@ts-expect-error` it carried to record where this defect class ended — leaving it would
have reddened `TS2578` under `tsconfig.test.json` — and the literal it guarded now
compiles, which is the assertion.

Marked `minor` per this repo's version-alignment rule: a published accept set widens, and
no declared shape narrows.
