---
"@object-ui/plugin-kanban": patch
---

Fix swimlane column titles sliding 9px off their columns at the right end of the board

A swimlane board scrolls on one horizontal axis: a scroll handler copies
`scrollLeft` from whichever row the user drove onto every other row. Equal
`scrollLeft` is equal alignment only while the rows have the same scrollable
range, and they did not — the lane content rows carried `px-2` that the
column-header row did not, making their maximum `scrollLeft` larger. Scrolled
fully right, the header row clamped at its own smaller maximum and every column
title sat 9px off its column until the user scrolled back.

The column-header row and the lane content rows now take their horizontal
padding from one shared constant, so the two ranges cannot drift apart. Measured
in Chromium at 1600x1000: the worst title/cell offset across the whole range,
including the extreme right, drops from 9px to the 1px lane-border baseline.
Card layout inside the lanes is unchanged.
