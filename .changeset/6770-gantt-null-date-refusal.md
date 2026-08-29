---
'@object-ui/plugin-timeline': patch
---

fix(plugin-timeline): refuse a `null` gantt date instead of drawing it at the epoch

`new Date(null).getTime()` is `0`, not `NaN` — the Unix epoch, not an invalid
date — so a `null` `startDate` / `endDate` passed the objectui#6759 parse guard
and reached the arithmetic as `1970-01-01`. One row item with `endDate: null`
drew a 649-column axis spanning 1970 to 2024 and a bar at
`left: 100%; width: -100%`, with no error and no diagnostic; a `null`
`startDate`, or both null, drew a bar with entirely plausible geometry on an
axis anchored in 1970 — a chart a reader would believe.

A `null` row date now renders the same `role="alert"` diagnostic objectui#6759
established, naming the authored path and spelling the value as `null`. This is
consistency with that card rather than a new policy: it already refuses the same
absence spelled `undefined` (an omitted `endDate`), and which of the two a
document carries is decided by the record mapping upstream, not by the author.

Unchanged: a `minDate` / `maxDate` pinned as `null` is falsy, so the caller
discards it and the rows' own range still renders; numeric timestamps and `Date`
instances still render; objectui#6750's empty-list sentinel and every valid
gantt are untouched.
