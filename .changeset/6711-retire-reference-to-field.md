---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` no longer copies `reference_to_field` onto a relational column's `fieldMeta`
(objectui#6711).

`RELATIONAL_META_KEYS` listed nine keys that `applyRelationalMeta` copies off the
object-schema field def onto the built `fieldMeta`, at all three of `generateColumns`'s
column-building call sites. `reference_to_field` had **zero member reads**: swept across
`packages/` and `apps/` (and again across the producer repo), the only occurrences of the
identifier anywhere were the array literal itself — the write — and prose recording that
nothing reads it. No member access, no destructuring, no bracket read.

The control that makes that zero a reading rather than an artefact of how the sweep was
written: the same sweep over its list-mates finds real readers for each of them —
`reference_to` / `reference` / `display_field` in `LookupCellRenderer`, and `id_field` /
`description_field` / `lookup_filters` / `lookupFilters` in `LookupField` / `UserField`,
which is what the grid's editable cells need.

Nothing renders differently. The key is not a member of any declared type on either end:
`applyRelationalMeta` writes into a `Record<string, any>`, the bag reaches cell renderers
through an `as any` cast, and the declared `FieldMetadata` union it is cast to does not
declare it (nor does `BaseFieldMetadata` carry an index signature). `@objectstack/spec`
17.2.0's `FieldSchema` does not declare it either — it is in none of that schema's 64
props — so nothing authorable produces it. This is the same defect class the sibling
producer retired twice: objectui#6625 (`FieldMeta.decimals`) and objectui#6597
(`FieldMeta.referenceTo`).

⚠️ **What the measurement bounds.** The sweep covers this repo and the producer repo. A
host application outside them could still be reading `reference_to_field` off the
`fieldMeta` a cell renderer receives; that was never a declared promise this renderer made,
and this repo's own contract is what the retirement is about — but the world was not
measured, and a host reading the key gets `undefined` after this change.

Because the key had no readers, the suite stays green whether or not the removal is
correct, so the absence is pinned directly instead
(`__tests__/relationalMetaCopySet-6711.test.tsx`): all three call sites, each with a
presence assertion on the eight surviving keys as the control against a fixture that
passes by never reaching the copy path.
