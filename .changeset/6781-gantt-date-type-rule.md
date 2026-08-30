---
'@object-ui/plugin-timeline': patch
---

Gantt dates are now judged by TYPE: a `string`, a finite `number`, or a `Date`
— anything else is refused (objectui#6781, maintainer ruling 2026-08-30).

**This is a reject-direction change. Metadata that renders a chart today can
stop rendering one.** `new Date(x)` runs ToPrimitive on anything, so values that
are not dates at all used to become instants silently. These now produce the
same loud diagnostic #6759 and #6770 already use — an alert naming the authored
path and the offending value — instead of a chart:

| `startDate` / `endDate` / `minDate` / `maxDate` | before | after |
| --- | --- | --- |
| `false` | a 649-column axis starting Jan 1970, bar `width: -100%`, no warning | refused, named |
| `true` | the same 1970 axis | refused, named |
| `['2024-01-01']` | drew a normal-looking chart | refused, named |
| `[0]` | drew a chart dated to the **year 2000** | refused, named |
| `{ toString() { return '2024-01-01' } }` | drew a normal-looking chart | refused, named |
| a `bigint` or a `symbol` | threw an uncaught `TypeError` mid-render | refused, named |

**If your gantt stops drawing after this upgrade, the diagnostic names the exact
authored path** (e.g. `items[0].items[0].endDate`). Fix it at the producer: emit
a date string (`'2024-01-01'`), a millisecond timestamp (`1704067200000`), or a
`Date`. A boolean or an object arriving in a date field means an upstream
mapping picked the wrong column — the chart was drawing 1970 from it before, and
that render was never right.

**`0` keeps working, deliberately.** It is a legitimate epoch timestamp — under
a millisecond encoding an author who writes `0` means 1970-01-01 — so it is
accepted and renders exactly as it did before. `NaN` and `Infinity` are refused,
as they already were.

Unchanged for everyone else: valid string / numeric / `Date` dates draw the same
axis and the same bar geometry, an empty gantt keeps its one-bucket sentinel,
and `null` / absent dates keep the identical diagnostic they got before.
