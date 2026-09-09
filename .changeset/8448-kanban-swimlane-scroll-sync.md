---
'@object-ui/plugin-kanban': patch
---

A horizontally scrolled swimlane Kanban board now keeps every column title over its own
column (objectui#8448).

**The defect.** The swimlane layout paints its column titles once, in a row above every
lane, and then paints each lane's cells in a row of its own. Both rows were
`overflow-x-auto`, so they were **independent scroll containers**: scrolling a lane
sideways moved that lane and nothing else. Measured in Chromium at 1600x1000 with five
columns, driving one lane to `scrollLeft: 298` left the header row at `0` — the `Open`
title at x=200 above an Open lane cell at x=-97. The row overflows at ordinary widths
there (`scrollWidth` 1840 against `clientWidth` 1552), so this was not an edge case at
narrow viewports.

Nothing errored. The board simply reported the wrong status for every card on screen,
which is worse than the height-0 header row objectui#7303 fixed: that one failed loudly,
this one reads as a working board.

**The fix is one horizontal axis for the whole board.** The header row and every lane row
now share a single scroll position: scrolling any of them scrolls all of them, in either
direction, and a lane expanded after the board was already scrolled joins the axis where
the board is rather than at 0. The two rows already carry the same left indent and the
same column widths (objectui#7303, objectui#8508), so an equal scroll position *is* the
alignment.

Per-lane independent horizontal scrolling is gone. Nothing asked for it: no prop, no
authorable schema key, no stored view setting and no test in this package held two lanes
at different positions — the package's only other `scrollLeft` reader is the flat
layout's mobile column indicator, which is untouched and stays off this axis.

Nothing about the board's vertical arrangement changed — no `overflow-y`, no height
bound, no sticky positioning — and the header row remains a scroll container that is not
shrinkable, the invariant objectui#7303 pinned.
