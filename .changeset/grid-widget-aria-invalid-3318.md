---
'@object-ui/fields': patch
---

Grid field widget: announce a form-level validation failure to assistive tech.

A required `grid` submitted while still empty rendered its "is required" message
but marked nothing — every row was a ghost row, and ghost rows were skipped by
the widget's per-cell validity channel. A sighted user saw the red message; a
screen-reader user was told nothing at all.

The host failure now drives the per-cell channel the widget already owns: when
the `error` slot is set on an empty grid, the ghost entry row's required cells
flag, and the mark sits on each cell's own control rather than on the `td`
wrapper (a `td` is not focusable, and assistive tech reads validity from the
control). Populated grids are unaffected — they already marked their own empty
required cells inline.
