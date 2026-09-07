---
'@object-ui/plugin-charts': minor
'@object-ui/i18n': minor
---

`ObjectChart` refuses an object-bound chart that declares no category axis (objectui#8168).

An object-bound chart that named no field to group by used to be composed anyway.
`runAggregate` passed `schema.aggregate` to `ds.aggregate(objectName, { field,
function, groupBy, filter })` with no guard on `groupBy`, and the `ds.find` leg
handed the same bag to `aggregateRecords`, which buckets every record on
`record[groupBy] ?? 'Unknown'`. So one path asked a driver to group by `undefined`
and the other collapsed the whole object into a single `'Unknown'` bar — and which
of those a reader saw was decided by the data source, not by the renderer. The only
loud states this component had were a fetch `error` (`chart-error`) and a generic
"No data yet"; neither is a statement about an absent binding.

`ObjectCalendar`, `ObjectGantt` and `ObjectTimeline` each already refuse a view that
declares no axis. This is the fourth, following `ObjectTimeline`'s shape
(objectui#7459): a `role="alert"` box, `data-testid="chart-missing-category-axis"`,
naming the bindings the author can declare — `aggregate.groupBy`, `xAxisKey`,
`xAxis.field` — rendered from the resolver's own vocabulary so the message cannot
drift from what the resolver reads.

**Breaking, deliberately — and this repo ships breaking as `minor`.** A chart that
previously rendered an `'Unknown'`-bucketed bar (or whatever the driver did with
`groupBy: undefined`) now renders the refusal instead. That is the intent: the
picture it drew was not a picture of the data.

It keys on the CATEGORY alone. A measure may legitimately be absent — `count` takes
no field — so refusing on an absent measure would refuse `count` grouped by a
declared category, a chart that renders correctly. Four shapes are deliberately
untouched: an ADR-0021 `dataset` chart (which may declare no dimension), a chart
carrying authored `data` or a `bind` scope (no field name is read to fetch those
rows), a spec-shape `xAxis: { field }` with no `xAxisKey` (resolved through
`normalizeChartSchema`, this package's one translation of the author-facing shape),
and every schema the five in-repo producers compose today — all five floor their own
category, so none of them can reach the refusal.

This does **not** retire the six `'name'` / `'value'` floors at the three relay faces;
that is the remainder of objectui#7547 and is mechanical only once this screen exists.

New key `chart.unconfigured.noCategoryAxis` in all ten locale packs.
