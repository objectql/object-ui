---
'@object-ui/plugin-charts': patch
---

Name the scatter legend's series, so its swatch stops reading as a stray data point
(objectui#7248).

The Chart Gallery scatter ("Estimate vs Progress") appeared to draw a seventh point
below the x-axis, outside the plot area. It was not a point. `ChartLegendContent`
resolves a label as `config[nameKey || item.dataKey || 'value']`, and a `<Scatter>`
carries **no `dataKey`** — scatter's keys live on the XAxis/YAxis, not on the mark — so
the key collapsed to the literal string `'value'`, missed a config keyed by measure
name, and the legend entry rendered its colour swatch with no text beside it. An 8x8
square in `--chart-1`, the same colour as the marks, sitting under the x-axis.

Measured on the running showcase in real Chromium: the swatch sat at cy 341 against a
plot area ending at cy 295, on a y scale of 4.835 px per unit — y = -9.5, at x ≈ 45.
That is the "x≈40, y≈-10" the report described, to the pixel, and all six real marks
were inside the plot area at every viewport width swept from 1440 down to 480.

**The y domain was not the defect and is unchanged.** Clamping it — the fix the report
asked for — would have created the bug it described: mixed-sign and all-negative
fixtures are pinned here drawing every mark, because recharts already extends the
domain to cover negative values.

Two changes. The scatter now passes `nameKey` so its legend resolves the measure's
label, and `ChartLegendContent` falls back to the series `name` recharts itself put on
the legend item when the config lookup misses. The second closes the class rather than
this one instance: the swatch renders unconditionally, so a config miss must never
leave it anonymous. Charts whose config already resolves are unaffected — only a
currently-empty label changes.
