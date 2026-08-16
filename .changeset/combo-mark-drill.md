---
'@object-ui/plugin-charts': patch
---

Combo charts drill from their marks

objectui#4692, ruled Option B. `AdvancedChartImpl` built `cartesianClickProps` once and
applied it to exactly one element — the final cartesian `ChartComponent`. The `combo`
branch returns earlier, from its own `ComposedChart`, which was rendered with `data` and
no click props at all, so a combo chart fired `onChartClick` never: not on a mark, not on
the axis. Its marks are the same `Bar` / `Line` / `Area` components the drillable branch
renders.

The trap that made this worth fixing rather than documenting is that the family is
**derived**, not only authored: `effectiveChartFamily` resolves a chart to `combo`
whenever its series declare different families (objectui#2945), so adding `type: 'line'`
to one series of a drillable bar chart silently turned that chart's drill-through off —
nothing in the authored spec said drill had been touched, and nothing errored.

A combo's `Bar` / `Line` / `Area` marks now emit `{ category, categoryId, series, value }`
with the same semantics the plain cartesian branch gives, reusing the item-level
series-identity machinery from objectui#4672 / objectui#4682: the mark handler records the
series it was rendered with, the chart-level handler composes the one event, so a gesture
still produces exactly one `onChartClick`. Retyping one series now changes that series'
mark and nothing else.

**Only the marks drill.** A click on a combo's plot surface or axis stays silent, where
the plain cartesian branch falls back to its axis-level answer. A combo plots several
measures on one plot, so a surface click there has no single series to report and the
fallback would have to invent one — the same reasoning objectui#4672's ruling gave the
pivoted case. Combo also carries no chart-wide pointer cursor for that reason; the
affordance sits on the marks that answer.

Radar is now the one cartesian-adjacent family with no click wiring. The `onChartClick`
doc comment, corrected in objectui#4705 to say combo was a no-op, states the new rule and
its one deliberate exception.
