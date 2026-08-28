---
'@object-ui/plugin-dashboard': minor
---

Retire `FieldMeta.referenceTo` and withdraw the README line documenting it as an
author-facing column override (objectui#6597, enforce-or-remove — withdraw branch).

**The measurement.** The README documented `referenceTo` as an author override you could
pass on a `object-data-table` column to "bypass auto-detection" of a lookup's related
object. Two `keyof FieldMeta` populations exist, kept separate per the card's own trap
warning: `DatasetRelationship.referenceTo` (a resolver's *output*, unrelated) and this
package's `FieldMeta.referenceTo` (the card's actual subject). For the latter, neither the
schema-derived value nor an authored column override ever reached a reader:
`LookupCellRenderer` (`@object-ui/fields`) resolves its lookup target from
`field.reference_to` / `field.reference` — never `field.referenceTo` — and
`computeLookupExpand` builds `$expand` from the OBJECT SCHEMA's field types, never from an
authored column key. Re-measured on this branch's base (`881d5c292`) with the
`referenceTo`-vs-`options` positive control already in
`ObjectDataTable.overrideSource-6425.test.tsx`: `options` (a live override) separates two
equal-valued columns; `referenceTo` does not — an authored override renders
byte-identical to its absence.

**No authoring story survived the search either.** `ObjectGrid`'s own relational-meta
pass-through (`applyRelationalMeta`, `plugin-grid/src/ObjectGrid.tsx`) copies
`reference_to` / `reference` / `display_field` / etc. from the SCHEMA field def only, at
all three of its call sites — never from an authored column override. No doc, example, or
fixture in this repo shows a table column pinning a lookup's target away from what its
schema field already says. Under the maintainer's standing startup-stage rule
(2026-08-27: deprecated/alias spellings retire immediately, no transition windows), no
measured demand selects withdraw.

**Both `keyof FieldMeta` seam bands, both in scope.** `ObjectDataTable` derives two
refusal bands from `keyof FieldMeta` — `EnrichedColumn`'s write-side tombstones
(objectui#6373) and `AuthoredColumnOverrides`' read-side band (objectui#6425) — so
deleting the member would have dropped `referenceTo` from both as a side effect, silently
un-enforcing objectui#6425's "not declared as spelled, still HELD" verdict. A new
hand-written `ObjectDataTableRetiredReferenceToTombstone` (`{ referenceTo?: never }`) is
intersected into both halves of the seam, the exact sibling of
`ObjectDataTableRetiredDecimalsTombstone` (objectui#6625) — same mechanism, same reason.
`ObjectDataTableColumnHolds` — the interface that carried the HELD verdict — is now empty
(kept, not deleted, as the documented extension point a future ruling holds a new key
onto).

**Ablation.** Removing the tombstone intersection (replacing it with the old
`{ referenceTo?: unknown }` HELD shape) turns two `@ts-expect-error` directives unused
(TS2578) — `tsc -p tsconfig.test.json` exits 2. Restoring the intersection returns a clean
exit 0. This proves the tombstone, not the derived band or a lingering hold, is what
refuses the key now.

**Behaviour is unchanged** — pinned by the unchanged `referenceTo reaches NOTHING on this
path` runtime assertion, and by two new counter-control tests (mirroring the ones
objectui#6625 added for `decimals`) proving the tombstone specifically is what refuses the
key at both seam bands.

Marked `minor` per this repo's version-alignment rule (AGENTS.md 版本号策略), which
reserves `major` for following `@objectstack` across a major. Scope note, measured rather
than assumed: `FieldMeta`, `AuthoredColumnOverrides`, `EnrichedColumn` and
`ObjectDataTableColumnHolds` are absent from `dist/index.d.ts` — `plugin-dashboard`'s
barrel re-exports only the `ObjectDataTable` component, and the package's `exports` map
publishes only `"."`. No downstream type moves; this is a package-internal contract change
plus a README correction, not a removal from a published type surface.
