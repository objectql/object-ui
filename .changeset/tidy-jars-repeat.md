---
'@object-ui/plugin-dashboard': patch
---

Fix dataset pivot cells showing another row's numbers when a dimension value contains a space.

The cross-tab cell key joined the row bucket id and the column bucket id with a plain space, so two rows whose ids met at a different point of the same string produced ONE key — `"New"` × `"York Q1"` and `"New York"` × `"Q1"` both spelled `New York Q1`. The later row silently overwrote the earlier one: the cell showed a different row's measure, the overwritten row's value was unreachable, and drill-through followed the same wrong index into the wrong records. Row and cell ids are now encoded with `JSON.stringify`, which needs no assumption about characters the data will not contain.

The row-subtotal lookup builds the same row bucket id and now shares that single encoder. It previously rolled its own join, which agreed with the row headers only when a pivot had exactly one row dimension, so the Total column rendered blank for any pivot with three or more dimensions.
