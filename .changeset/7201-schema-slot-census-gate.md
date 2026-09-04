---
---

Gate the `plugin-grid` schema-level held-key census on its ENTRY CONDITION
(objectui#7201). The census's only pin asserted that the seam ACCEPTS
`renderCellEditor` and `cellClassName` — equally true while the keys are held
locally and once they arrive through `DataTableSchema` — so it stayed green
across objectui#6882, the ruling that expired both holds. The suite now also
carries the column-level twin's shape (`columnHoldsExpiry-6424.test.ts`):
a compile-time verdict per member of `ObjectGridDataTableSchemaHolds` recording
whether `DataTableSchema` declares that key, plus a pin on the member set so the
gate is per HOLD rather than per key somebody remembered.

No behaviour change and no published API change: compile-time assertions in
`packages/plugin-grid/src/__tests__/`, plus the one census paragraph in
`ObjectGrid.tsx` that this change falsifies — it said nothing above it was
mechanically checked.
