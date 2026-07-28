---
"@object-ui/plugin-charts": minor
---

feat(charts): honor `ChartAxis.stepSize`, `ChartConfig.description` and `ChartConfig.height` (framework#3752)

The tail of the declared-≠-delivered sweep from framework#3729 / #2880. Three
`ChartConfig` props reached the renderer and did nothing:

- **`ChartAxis.stepSize`** — Recharts has no "a tick every N units" prop
  (`tickCount` is a hint it may ignore, `interval` is for categorical axes), so
  honoring a step means handing it the tick array outright. `ticksFor` builds it
  from the axis's own `min`/`max` where declared and from the plotted values
  otherwise, so a step works with or without a pinned domain. A data-derived max
  rounds UP to the next step (otherwise the topmost bar sits above the last
  gridline and the axis reads as truncated); an explicit `max` clamps instead,
  since a tick outside a pinned domain would be drawn outside the plot. A step
  that would produce more than 200 ticks is refused rather than rendered — that
  is a wrong config, and drawing it would hang the page instead of surfacing the
  mistake.
- **`ChartConfig.description`** — the accessibility description. A chart is a
  picture to a screen reader; the container now carries `role="img"` +
  `aria-label`. Without a description it stays an ordinary div, because
  stamping `role="img"` on an *unlabelled* graphic is worse than leaving one a
  screen reader can skip.
- **`ChartConfig.height`** — was read only by the legacy `ChartBarRenderer`, not
  by the advanced path that draws every real chart. Now applied to the chart
  container as an inline style, which beats its default `h-[350px]` class.

`height` and `description` ride on the shared container props, so they apply to
all eight chart families rather than one branch.
