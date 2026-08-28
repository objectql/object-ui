---
'@object-ui/plugin-grid': minor
---

feat(plugin-grid): type the data-table schema slot ObjectGrid fills

`const dataTableSchema: any` becomes `ObjectGridDataTableSchema`, and
`buildGroupTableSchema`'s return carries the same annotation, so the ~46 keys
this grid writes into the `data-table` slot are finally checked against the
slot's declaration — the receiver half of the seam whose producer half #6004
typed. The `(dataTableSchema.columns as any[])` cast in the grouped writer
drops with it.

The annotation is not a bare `DataTableSchema`, and that is the substance:
measured on this program, a bare annotation with an undeclared bogus key
written longhand in the fresh literal compiles with **zero** diagnostics,
because `BaseSchema`'s `[key: string]: any` index signature makes every key a
member — excess-property checking never has a non-member to refuse.
`ObjectGridDataTableSchema` derives from `DataTableSchema` by stripping the
index signature (never by hand-listing members), which makes the same probe go
red (TS2353) at both writer literals — shown able to fail before being claimed
as coverage, per the #6004 rule.

Two schema-level keys the grid passes are undeclared on `DataTableSchema` and
HELD at the seam with measured live readers in `data-table`:
`renderCellEditor` and `cellClassName`. Whether `DataTableSchema` should
declare them is filed for a ruling — nothing is declared on or retired from
`@object-ui/types` here.
