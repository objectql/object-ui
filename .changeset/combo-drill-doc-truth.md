---
---

Test-and-docs only: corrects `AdvancedChartImpl`'s `onChartClick` doc comment to what is
actually wired (bar/horizontal-bar/line/area/pie/donut/funnel/scatter/treemap/sankey; the
comment previously listed scatter/treemap/sankey as no-ops though each already has a wired
click handler) and names the derived-family trap — a series' own `type` disagreeing with
the chart's family silently turns the whole chart into a `combo`, which has no click
wiring at all, so an author changing one series' mark can lose drill on the entire chart.
Pins that combo's current no-click-props state with a positive-control test (an
identically-shaped click on a plain bar chart still fires `onChartClick`).

No renderer behaviour changes — `ComposedChart` still receives no click props. Whether
combo should drill is left open (objectui#4692).
