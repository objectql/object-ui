---
---

No published behaviour changes, and nothing declared or retired.

`ObjectDataTable.enrich()` read six field-meta overrides off the AUTHORED column — three
through `(col as any)`, two more through the column bag's `[key: string]: any`, which
answers `any` just as loudly without the tell (objectui#6425). Those reads now go through
a local `AuthoredColumnOverrides` keyhole: every honoured key carries a written verdict
and the card that owns it, and every other `FieldMeta` member is refused by a DERIVED
`?: never` band, so a seventh one has to be adjudicated instead of admitted by silence.

Type-only at the seam plus a new test file. `@object-ui/types`' `TableColumn` and its zod
mirror are untouched: whether `format` / `options` / `referenceTo` / `currency` /
`decimals` get declared on the published type or retired stays objectui#6425's open
ruling, and this change is the per-key evidence that ruling needs, not the ruling.
