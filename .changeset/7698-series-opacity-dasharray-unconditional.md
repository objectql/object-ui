---
'@object-ui/plugin-charts': minor
'@object-ui/types': patch
---

Chart `series[].opacity` and `series[].dashArray` are honoured on every series,
not only on a `variant: 'comparison'` one (objectui#7698).

`@objectstack/spec` declares `ChartSeries.opacity` ("Override series opacity")
and `ChartSeries.dashArray` ("Override stroke dash pattern") as unconditional
per-series overrides, and `normalizeSeries` read both off every series. The
renderer then honoured them on a comparison overlay only, so an author who
wrote `{ name: 'cost', opacity: 0.6 }` or `{ name: 'cost', dashArray: '4 4' }`
on a primary series got a mark drawn exactly as if the key were absent. Fixed
in the renderer rather than by narrowing the published declaration to match:
the spec is the contract of record, and a renderer's partial implementation
does not get to dictate it (AGENTS.md #0.1).

**Two gaps, not one.** The `variant` guard was the visible half — `comparisonStyle`
returned `null` for any other variant. The second half only showed on
`dashArray`: that helper already returned an AUTHORED dash for every family
(the `??` takes the left side whatever the kind), and the **Bar and Scatter
marks** then passed `fillOpacity` only, dropping `strokeDasharray` and
`strokeOpacity` on the floor — so an authored dash was lost on those two
families even on a comparison series. A fix aimed at the guard alone would have
left that untouched. `comparisonStyle` is now `seriesStyle`, and the Bar and
Scatter marks pass all three channels.

**Comparison series are unaffected.** The authored branch already won over the
muted defaults, and those defaults stay gated on `variant: 'comparison'`: a
comparison series carrying neither key keeps its lower opacity and its `'4 4'`
line/area dash exactly as before. The two stroke defaults no mark ever consumed
(bar and scatter — neither is stroked by this renderer) are now spelled
`undefined`, so opening `strokeOpacity` on those marks does not hand them a
default they never had.

Only a stroked mark can show a dash, so on a `bar` or `scatter` mark an
authored `dashArray` reaches the mark and paints nothing — the mark's geometry,
not a condition on the key. The `ChartDataSeries` mirror docs and the
plugin-charts reference, which stated the comparison-only condition as an
interim measure, are corrected in the same change.
