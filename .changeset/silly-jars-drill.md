---
'@object-ui/plugin-charts': patch
---

Cartesian chart clicks report the clicked series and value again

objectui#4672. `AdvancedChartImpl`'s chart-level click handler built its drill
event from `payload.activePayload[0]` — a **recharts 2** field. This package is
on recharts 3, which hands a chart-level `onClick` a `MouseHandlerDataParam`:
`{ activeCoordinate, activeDataKey, activeIndex, activeLabel, activeTooltipIndex,
isTooltipActive }`, and nothing else. `activePayload` appears nowhere in the
shipped library, so the read was `undefined` on **every** cartesian click and
every bar / line / area drill event carried `series: undefined, value: undefined`.
Nothing went red: the payload is typed `any` at the call site, and every existing
drill test either calls the pure lookup directly or stubs the chart.

The handler now works from the payload recharts 3 actually sends:

- **The value** is read off the clicked row — `data[activeTooltipIndex]`, the
  array this component was given — for the resolved measure, the same way the
  bucket identity has been read since objectui#4508.
- **The series** comes from `activeDataKey` when the payload carries one, and
  otherwise from the chart's own series list when it plots exactly one series,
  where the clicked column can belong to nothing else.
- **A click with no active tick** (the plot margins, an axis label) resolves to
  no row instead of to bucket zero. recharts reports a **null** index there, not
  an absent one, and `Number(null)` is `0` — so such a click used to drill the
  first bucket's records. That is a wrong drill, not a dead one.

A drill on a single-measure chart therefore names its measure and carries its
value again — `resolveDrillTitle` composes the drawer title from them, and an
authored drill filter can reference `${event.value}`.

**Still open, deliberately:** a chart plotting several series under the default
SHARED cursor. Measured against recharts 3.10.1, an axis interaction is
dispatched with `activeDataKey` hard-coded `undefined` (bar, line and area
alike, on the mark and on empty plot area), so the payload names no series at
all — and a pivoted dataset chart's drill lookup requires one. The series is
left unresolved rather than guessed: naming a series the user did not click
drills to another group's records, which is worse than the dead click. Resolving
it needs the clicked mark rather than this payload; objectui#4672 carries that
half.
