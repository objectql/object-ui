---
'@object-ui/plugin-view': patch
---

`ViewSwitcher` draws an icon for `chart` and `gantt` views again, and both
icon maps in the package now name only spellings lucide still resolves
(objectui#5586).

`ViewSwitcher.resolveIcon` turns an icon NAME into a component by looking it up
in lucide's runtime `icons` record. lucide retires a spelling by dropping it
from that record while KEEPING it as a deprecated named export, so a retired
name still imports, still type-checks and still renders as a component — and
silently resolves to nothing as a string. `ObjectView` composes the switcher
from names, and two of them had been retired on lucide-react 1.31.0:
`chart: 'bar-chart-3'` and `gantt: 'gantt-chart'`. Both view types rendered as a
label with no icon at all while every sibling type had one, and nothing went red
because no lucide symbol appears in that map for the compiler to check. Measured
against the installed package: `BarChart3` and `GanttChart` are absent from
`icons`, while `ChartColumn` and `ChartGantt` are present.

- `ObjectView`'s `iconMap`: `bar-chart-3` → `chart-column`,
  `gantt-chart` → `chart-gantt`.
- `ViewSwitcher`'s `DEFAULT_VIEW_ICONS`: the adjacent entries that named
  deprecated aliases move to the names the record carries —
  `BarChart3` → `ChartColumn`, `GanttChartSquare` → `ChartGantt`,
  `Grid` → `Grid3x3`. `ChartColumn`/`Grid3x3` are the same components the
  aliases already pointed at, so those two glyphs are unchanged; the `gantt`
  default picks up the plain gantt glyph, which is what `iconMap` now supplies
  for that view type.

The regression pin widens from `tree` alone to EVERY name both maps supply: a
pin scoped to the two names that broke would not have caught this and would not
catch the next lucide bump.
