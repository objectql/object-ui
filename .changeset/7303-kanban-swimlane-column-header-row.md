---
'@object-ui/plugin-kanban': patch
---

Keep the kanban column-header row visible when swimlanes are on (objectui#7303).

Turning swimlanes on for a board — `grouping.fields[0].field`, which is the only
authorable route, since `KanbanConfigSchema` is strict and rejects
`kanban.swimlaneField` — removed the status column titles from the screen. They
stayed in the DOM, at the right coordinates, painting nothing, so the board read
as an unordered card wall: the lane told you the caliber of the work and nothing
told you its state.

The cause is a flexbox rule rather than a paint bug. The header row is a flex
item of the swimlane region (a `flex-col` inside a height-bounded board), and its
`overflow-x-auto` makes it a scroll container — which zeroes a flex item's
automatic minimum size, so it may legally be shrunk to height 0. The lanes below
keep `overflow: visible`, so their own automatic minimum size clamps them at
content height and they refuse to shrink; the moment the lanes overflowed the
board, the entire deficit landed on the one shrinkable item. The row now carries
`shrink-0`, which takes it out of that pool.

Note the trigger, because it decides who saw this: the collapse needed the lanes
to OVERFLOW the board's bounded height. A board short enough to fit rendered its
titles normally, which is why this presented in the field as "sometimes the
column labels are missing" rather than as a flat breakage of swimlanes.

Measured in Chromium 1194 at 1600×1000 on the component's own rendered markup:
header row height 0 → 24, header cell 0 → 24, and `elementFromPoint` at a title's
own centre returning the lane-collapse button before the fix and the title itself
after it. Nothing else about the layout moves — the row keeps its `pl-36 sm:pl-44`
alignment with the lane content rows, and the non-swimlane board is untouched.
