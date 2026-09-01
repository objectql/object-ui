---
---

Re-derives the held-key censuses in `packages/plugin-grid/src/ObjectGrid.tsx` and corrects
the seven claims that no longer match the tree. Comments and one test docblock only — no
runtime code, no exported type, no declared member moves, so nothing publishes.

The card (objectui#7196) was filed on ONE measured entry: the schema-level census still
listed `renderCellEditor` as an undeclared-but-live HELD key and called the `packages/types`
ruling on it "pending", when objectui#6882 had declared it on 2026-08-30. The card
deliberately did not claim the other entries were correct, only that nobody had checked, so
all sixteen claims across both censuses in the file were re-derived against `origin/main`
rather than read. Seven were defective:

Stale — correct when written, drifted since:

- `renderCellEditor` — declared by objectui#6882 on three surfaces (the member, the Zod
  mirror, an `Equal` exact-shape pin). The `(schema as any)` cast the census cites went
  with the declaration.
- `cellClassName` — declared by the SAME ruling. The card did not name this one; the
  re-derivation did. The census called it a hold with a "pending ruling" too.
- "leaves exactly TWO undeclared keys" — diffing the 46 flat-literal keys plus the 8
  group-literal keys against `DataTableSchema`'s declared members now leaves ZERO.
- the consumer read set listed fourteen `col.<key>` reads in `data-table.tsx` including
  `name`; objectui#6963 retired that alias on 2026-08-31, so it is thirteen.

Wrong when written, not drift:

- the schema-level `cellClassName` was described as folded "into every body cell's
  `className`". It reaches exactly three UTILITY cells (selection, row-number,
  row-actions) and never a data cell, which folds the per-column twin. The failure mode
  the census names is wrong in the same way. objectui#6882's declaration carries the
  correct version upstream; this makes the local copy agree with it.
- "the 7-literal union `TableColumn` declares" — it has been eight since objectui#6370
  (2026-08-25), a day before the docblock was written; that commit's own subject says
  "8-literal".
- the downstream read list omitted four keys the chrome passes read to re-express
  (`className`, `cellClassName`, `sortable`, `cell`). All three passes predate the list.

Nine claims re-derived clean and are recorded as such, including every column-level
verdict (`headerIcon`, `pinned`, `wrap`, `options`, `essential`, `name`) and the
`FieldType` count of 49.

The holds type is left in place, with its docblock rewritten to record that it is now
redundant rather than load-bearing and what was measured toward removing it. Deleting a
member of an exported type is a different kind of change and gets its own card, the way
objectui#6615 was followed by objectui#6424 for `headerIcon`.
