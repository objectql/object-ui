---
'@object-ui/plugin-charts': minor
'@object-ui/plugin-dashboard': minor
---

`compareTo` on a `scatter` chart is no longer supported — scatter joins pie / donut /
funnel on the list of chart families that ignore it (objectui#7402, maintainer ruling
2026-09-03).

**This removes a published capability, deliberately.** Until now a `chartType: 'scatter'`
chart (and the dashboard widget types `scatter` and `bubble`, which both render as one)
with `compareTo` set synthesised a muted "previous period" overlay series. It drew the
wrong picture: a scatter binds ONE measure, and the renderer reads y through the single
`YAxis dataKey={series[0].dataKey}`, so the overlay was plotted on the PRIMARY series' y
— "previous period" painted exactly on top of "current" (objectui#7194).

Enforce-or-remove: rather than keep drawing that, the capability is removed until it can
be drawn honestly. Drawing a real second measure on a scatter needs the multi-measure
projection recorded as option A of objectui#7194, which is not built (zero authored
callers). **If and when that projection lands, `compareTo` on a scatter returns with
it** — it is the same missing mechanism, one payment.

What changes for authors:

- A `compareTo` on a scatter is now IGNORED rather than drawn. The primary series still
  renders exactly as before — nothing refuses, nothing goes blank, and no comparison
  query is issued on the inline chart path.
- No `<measure>__comparison` (inline chart) / `<measure>__compare` (dashboard) series is
  appended for a scatter, so a compare-to scatter document also never reaches the
  two-or-more-series scatter refusal being added under objectui#7194.
- Charts that keep the overlay: line, area, bar, horizontal-bar, combo. Charts that
  ignore `compareTo`: pie, donut, funnel and — as of this change — scatter (and the
  `bubble` widget type that renders as a scatter).

Reachability at the time of the change: **0** authored scatter/bubble instances in-repo
across both spellings (control `"type": "bar"` fires at 5 example files); incidence in
deployed tenant metadata is not measurable from this repo.
