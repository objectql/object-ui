---
"@object-ui/app-shell": patch
---

ObjectView no longer forwards `chart.config` onto the `object-chart` node it builds.

`@objectstack/spec`'s `ListChartConfigSchema` is a `strictObject` declaring exactly
`chartType` / `dataset` / `dimensions` / `values`, and objectui binds it by reference, so
`config` is refused by name (`unrecognized_keys ["config"]`) — by the client schema and by
the same schema the platform's metadata write door parses every save through. The rung was
therefore a channel no conforming author could feed, on both the dataset and the legacy
branch, and it landed on a node that does not declare `config` either.

For every spec-conforming view this is a no-op. A non-conforming row that somehow carried
the key degrades rather than breaks: `ChartRenderer` generates a container config from
`series` plus a positional palette when none is present, so the chart still renders, with
series-derived labels and default colours.
