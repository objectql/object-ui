---
'@object-ui/plugin-dashboard': patch
---

A dashboard chart's null-value bucket now reads the app's language instead of the English `(None)`

`buildChartSeries` groups rows whose category value is `null` under a labelled bucket, so the group draws as a bar instead of vanishing off the axis (objectui#4466). The label comes from the caller: `@object-ui/core` is React-free, cannot read the locale bundle, and falls back to the English constant `(None)`. `ObjectChart` passes its resolved label and localizes; `DatasetWidget` called the same helper with no options, so a dashboard widget in a zh app labelled the bucket `(None)` while the standalone chart one panel over labelled it `(未指定)`. It now passes `chart.nullCategory` from the i18n channel, which every locale pack already carries.

The same label goes to `findChartSeriesRow`, and that half is what keeps the bar clickable. That helper is the inverse map behind segment-click drill-through: it compares the clicked category against its own copy of the bucket label, defaulting to the same English floor. Passing the localized label to only the forward call would draw a bar reading `(未指定)` while the drill matched `(None)` — the click resolves to no row and the drawer never opens, which is a worse outcome than the untranslated word this fixes. Both calls now read one binding, so they cannot drift apart.

Nothing else moves: non-null categories chart and drill exactly as before, an `en` app still reads `(None)` (now via its locale pack rather than the hardcoded floor), and a widget over data with no null group is untouched.
