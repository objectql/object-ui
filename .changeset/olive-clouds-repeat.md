---
---

`RelatedList`: document at `makeCell`'s untyped-field guard why an untyped column
gets no cell — and therefore no objectui#8459 placeholder — and why attaching a
"minimal cell" there is not the shortcut it looks like (the data-table's no-cell
branch applies `String()` and `formatCellValue()`, and a cell's return value goes
straight to React, so an object value throws instead of rendering
`[object Object]`). Comment only; no behaviour change, nothing to release. The
successor that can actually close the gap is objectui#8817.
