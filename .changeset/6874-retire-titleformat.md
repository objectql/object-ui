---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` no longer copies `titleFormat` onto a relational column's `fieldMeta`
(objectui#6874).

`RELATIONAL_META_KEYS` listed eight keys that `applyRelationalMeta` copies off the
object-schema field def onto the built `fieldMeta`, at all three of `generateColumns`'s
column-building call sites. `titleFormat` was one of them and had **zero FIELD-meta
readers**.

This is a zero of a different kind from objectui#6711's, and a stronger one: `titleFormat`
is a real, live key with plenty of readers — it just has none on a field meta. The sweep
did not fail to find readers. It found every member read of the identifier across
`packages/` and `apps/` (tests included) and classified each by its receiver:

- `objectDef` / `objectSchema` / `objSchema` — `core/utils/record-title.ts`,
  `components/renderers/layout/containers.tsx`, `plugin-detail/DetailView.tsx`,
  `plugin-kanban/ObjectKanban.tsx`, `plugin-calendar/ObjectCalendar.tsx`,
  `react/hooks/useRecordSearch.ts`. An OBJECT schema, every one.
- `refObjectSchema?.titleFormat` — `fields/widgets/LookupField.tsx`: the REFERENCED
  object's schema, fetched by `getSchema(referenceTo)`. Also an OBJECT schema, and the one
  that decides this case — it is what the grid's own inline picker reads.
- `param.titleFormat` — `app-shell/utils/paramToField.ts`, off a resolved `ActionParamDef`.
  The field-def read beside it is `field.title_format`, a different spelling on a different
  surface.

`RecordPickerDialog` and `lookupColumnDisplay` receive it as a PROP, and the repo's single
`titleFormat=` pass is `titleFormat={refTitleFormat}` — object-schema sourced. So copying
`reference_to` is what makes `titleFormat` work on this path, and copying `titleFormat`
onto the meta reached nothing.

Nothing renders differently, and the argument does not rest on the member sweep alone: the
only computed access to the meta bag anywhere in `@object-ui/fields` or `plugin-grid` is
`applyRelationalMeta`'s own write, so no consumer can pick the key up dynamically. The key
is also not a member of any declared type on this path — `applyRelationalMeta` writes into
a `Record<string, any>` and the bag reaches cell renderers through an `as any` cast.

`plugin-dashboard/src/recordFields.tsx` had already recorded this exact measurement as its
reason for not copying the key into that seam, so it was a measured no-op in two seams and
retired from only one. Same defect class as objectui#6625 (`FieldMeta.decimals`),
objectui#6597 (`FieldMeta.referenceTo`) and objectui#6711 (`reference_to_field`), and the
same disposition as objectui#6711 on this very list.

⚠️ **What the measurement bounds.** The sweep covers this repo and the producer repo. A
host application outside them could still be reading `titleFormat` off the `fieldMeta` a
cell renderer receives; that was never a declared promise this renderer made, and this
repo's own contract is what the retirement is about — but the world was not measured, and a
host reading the key off a field meta gets `undefined` after this change. The supported
source is unchanged and unaffected: the referenced object's schema.

Because the key had no readers on this path, the suite stays green whether or not the
removal is correct, so the absence is pinned directly instead
(`__tests__/relationalMetaCopySet-6874.test.tsx`): all three call sites, each with a
presence assertion on the seven surviving keys as the control against a fixture that passes
by never reaching the copy path.
