---
'@object-ui/plugin-dashboard': minor
---

Dashboard `table` widget — a numeric **measure** column now sorts **descending
on the first click** (objectui#5845).

The sortable headers shipped in objectui#5827 started every column ascending,
which left the card's own motivating complaint — the largest industry rendering
last — two clicks away. For a measure in an analytics widget the question a
click asks is "who is biggest", so that column now cycles
**descending → ascending → the dataset's own order**.

Unchanged: a **dimension** column, and a measure whose values are not numbers
(a `min()`/`max()` over a text field), keep **ascending → descending → the
dataset's own order** — the idiom the console's own DataTable uses. The
first-click direction is decided by the same measure-and-all-values-are-numbers
classification that decides right-alignment, so it follows the column's *role*
rather than "it looks like digits": a digit-keyed dimension (a year, a quarter)
still starts ascending.

Blanks still sort **last in both directions** — that arm is now what a measure
column's very first click runs — and `aria-sort` reports the direction actually
applied.
