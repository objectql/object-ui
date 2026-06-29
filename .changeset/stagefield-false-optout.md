---
'@object-ui/plugin-detail': patch
---

detail synth: `detail.stageField: false` (or `null`) now explicitly opts a
record page out of the auto status-path stepper.

`detectStatusField()` previously only treated a truthy `stageField` (a field
name) specially and otherwise auto-detected a `status` / `stage` / `state` /
`phase` field by name or type. Objects with a non-linear `status` picklist
(e.g. 正常 / 暂停 / 作废) had no way to suppress the inappropriate ordered
`record:path` stepper.

The hint is now read from the spec's `detail` block (`object.zod.ts` — a
`.passthrough()` object already documented as "Detail-page UI hints consumed by
@object-ui/plugin-detail synth"), which is the author-reachable location:
`ObjectSchema.create()` rejects unknown *top-level* keys, so a bare top-level
`stageField` could never be set on a spec-authored object. Authors now write
`detail: { stageField: false }` to opt out, or `detail: { stageField: 'field' }`
to pick the path field. The top-level `stageField` is kept as a back-compat
fallback for raw/duck-typed defs. Default behavior unchanged.
