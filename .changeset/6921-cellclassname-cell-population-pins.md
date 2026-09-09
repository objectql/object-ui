---
---

Test-only and comment-only change (objectui#6921); no published behaviour changes.

Pins, in the rendered DOM, which body cells the SCHEMA-level `cellClassName` on
`DataTableSchema` reaches: exactly the three utility cells (selection, row-number,
row-actions) and never a data cell, which folds the per-column `TableColumn.cellClassName`.
The pin is also the fence the card draws — a renderer that made the old "every body cell"
sentence true by folding the schema-level key into data cells goes red — and the
non-regression for the three cells that legitimately fold it.

Pins the corrected census prose in `packages/plugin-grid/src/ObjectGrid.tsx` (present,
names the measured cells, records the hold as over) and adds a pointer from that prose to
the measurement. Corrects the one surviving in-repo copy of the false sentence, a test
docblock in `packages/types`.
