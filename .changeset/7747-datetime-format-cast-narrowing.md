---
---

Narrow the `DateTimeCellRenderer` style cast from `as any` to the subtype that
actually declares the property (objectui#7747).

`const style = (field as any)?.format || 'compact'` becomes
`(field as DateTimeFieldMetadata | undefined)?.format`. Some cast is
load-bearing — `FieldMetadata` is a 37-member union and `BaseFieldMetadata`
carries no `format`, so the bare read is `TS2339` — but `as any` was wider than
the job: `DateTimeFieldMetadata` is exported from `@object-ui/types`, which this
file already imports from, so the narrow cast was available at zero cost. The
difference that buys: `as any` would also have silenced a typo in the property
name, and the narrow cast will not.

Type-level only; no package is released by this change. The emitted expression
is identical, so every cell renders exactly what it rendered before —
`'compact'` and an absent or empty `format` keep the compact face, and any
other value keeps selecting the verbose `formatDateTime` default.
