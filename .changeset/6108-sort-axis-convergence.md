---
'@object-ui/plugin-list': patch
'@object-ui/plugin-detail': patch
---

The last three sort-axis consumers read the platform's per-column sortability signal instead
of re-deriving it from the field's type (objectui#6108, inheriting objectstack#10235 ruling A
through objectui#5729's landed contract). ListView's toolbar sort picker and both of
RelatedList's sort entry points — the embedded table's column headers and the `data-list`
sort-button row — now go through `isPlatformSortableField`, the same spelling the grid header
adopted; their `UNMATERIALIZED_FIELD_TYPES` / `isUnmaterializedFieldType` re-derivations are
deleted.

The re-derivation was not wrong about `formula`: the platform computes its own projection from
the same `@objectstack/spec` storage fact, which is why the drift went unnoticed across two
cards. It parts company on everything the projection encodes as ABSENCE — an unknown name, a
dotted path a caller can put in a related list's `columns`, an unprovisioned audit column —
where a type read finds no field definition, answers "sortable", and offers a control the
runtime meets with `400 INVALID_SORT`. It parts company again on any refusal that carries no
`reason: virtual-type`, and it cannot follow the platform in the other direction either: a
field the platform now DOES order by stays withheld forever on its type alone.

Two behaviours are deliberately unchanged. The relational carve-out stays separate from the
signal — the projection answers `sortable: true` for a `lookup` because the platform can order
by the stored foreign key, while the UI withholds because that order means nothing beside a
column of names — so a relational column does not get its sort back. And ListView's picker
still lists a field the CURRENT sort already names, which is the only way to remove a sort the
server refuses outright; that exception now covers platform-refused fields, not just formulas.

A deployment that served no `sortability` key at all is a different case from "nothing is
sortable": that branch keeps the type read as a compatibility floor, so behaviour on a backend
older than objectstack#10235 (or an inline/mock data source) is byte-identical to before.
