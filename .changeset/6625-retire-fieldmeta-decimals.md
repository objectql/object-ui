---
'@object-ui/plugin-dashboard': minor
---

Retire `FieldMeta.decimals` and the now-unfed `BuildFieldMetaParams.overrides.decimals`
from `plugin-dashboard`'s shared field-rendering helpers (objectui#6625,
enforce-or-remove).

`buildFieldMeta` computed `decimals: overrides.decimals ?? meta?.decimals ?? meta?.scale`
on **every** call and the value **reached nothing**. Re-measured on this branch's base
(`efdc6c62`): **zero `.decimals` member reads** across `@object-ui/fields`,
`@object-ui/i18n`, `@object-ui/components`, `@object-ui/core` and `plugin-dashboard`
itself — the only non-comment occurrence was the write being removed here. The
**positive control in the same query shape** fires: `.scale` member reads hit
`NumberField.tsx`, `GridField.tsx` and `fields/src/index.tsx`. So the zero is a
finding, not a broken query. The `overrides.decimals ??` head of that chain had already
lost its only feeder when objectui#6425's ruling removed the authored read from
`ObjectDataTable.enrich()`; `RecordDetailDrawer`, the only other `buildFieldMeta`
caller, passes no overrides at all. Both halves retire together, so the key leaves in
one move.

Behaviour is unchanged — no reader existed to notice, pinned by the unchanged runtime
assertion in `ObjectDataTable.overrideSource-6425.test.tsx` that an authored `decimals`
renders byte-identical to its absence.

**The refusal did NOT leave with the member.** `ObjectDataTable` derives *two* refusal
bands from `keyof FieldMeta` — `EnrichedColumn`'s write-side tombstones (objectui#6373)
and `AuthoredColumnOverrides`' read-side band (objectui#6425) — so deleting the member
would have dropped `decimals` from both as a side effect, silently un-enforcing
objectui#6425's retire. A new hand-written `ObjectDataTableRetiredDecimalsTombstone`
(`{ decimals?: never }`) is intersected into both halves of the seam, the same shape and
for the same reason as `ObjectGrid`'s `ObjectGridRetiredOptionsTombstone`. The verdict
is unchanged since 2026-08-27; only the artefact enforcing it moved, from derived to
hand-written.

Marked `minor` per this repo's version-alignment rule (AGENTS.md 版本号策略), which
reserves `major` for following `@objectstack` across a major. Scope note, measured rather
than assumed: `FieldMeta`, `BuildFieldMetaParams`, `AuthoredColumnOverrides` and
`EnrichedColumn` are **absent from `dist/index.d.ts`** — they are not re-exported by the
package barrel, and the `exports` map publishes only `"."`, so no consumer can name them.
No downstream type moves; this is a package-internal contract change.
