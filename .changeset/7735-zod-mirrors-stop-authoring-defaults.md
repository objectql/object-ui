---
'@object-ui/types': minor
'@object-ui/components': patch
---

The zod mirrors stop authoring defaults; the renderer's fallback is the one
authoritative default (objectui#7735, director ruling, decision batch #69,
2026-09-07 — maintainer reply 「其他同意」).

**A validator validates; it does not write values into an author's document.**
`.default(v)` on a mirror member is not documentation — `parse` SUBSTITUTES `v`
into the output when the key is absent. One authored document therefore had two
shapes depending on whether it had been through `safeValidateSchema`, and where
the mirror and the renderer disagreed the mirror silently won:

| key | mirror wrote | the renderer applies |
|---|---|---|
| `ContainerSchema.maxWidth` | `'lg'` | `container.tsx`: `?? 'xl'` |
| `FlexSchema.align` | `'center'` | `flex.tsx`: `\|\| 'start'` |

A `container` omitting `maxWidth` rendered `max-w-xl` as authored and `max-w-lg`
after a round-trip through the mirror; `'center'` is a value neither `flex` nor
`stack` applies at all. `StackSchema` already declared no defaults, so the file
was not even self-consistent.

**What changed.** All 41 `.default()` call sites under `packages/types/src/zod/`
are removed — `layout.zod.ts` 22, `crud.zod.ts` 11, `form.zod.ts` 5,
`views.zod.ts` 2, `app.zod.ts` 1. `@object-ui/components` reconciles the third
face objectui#8229 found: `flex`'s registration `defaultProps.align` seeded
`'center'`, the value its own renderer never applies, so a designer-made node
laid out differently from a hand-authored one; it now seeds `'start'`.

**Accept set unchanged.** Every one of the 41 was spelled
`<type>.optional().default(v)`, so none was carrying optionality: nothing that
parsed before is refused now, and nothing refused before is accepted. This is a
narrowing of `parse` OUTPUT only.

**Migration.** Rendering does not change: every renderer already carried its own
fallback, and the two that disagreed were the bug. What changes is `result.data`
from `validateSchema` / `safeValidateSchema` — for a document that OMITS one of
these keys the key is now absent from the parsed output instead of carrying a
substituted value. If you read a default off the parsed document rather than
applying your own fallback, apply the fallback yourself. The in-repo census
found no such reader: of the four modules importing `@object-ui/types/zod`, two
read only `result.success`, one discards `result.data`, and `os validate` reads
only `type` / `id` / `label` / `title` / `children`, none of which ever carried a
default.

Note that `safeValidateSchema` still substitutes through subschemas imported by
reference from `@objectstack/spec` (`app.active`, `object-view.navigation.*`,
`list-view.sharing.type`, and others). Those values are written in that package,
not this one, and are unaffected by this change.
