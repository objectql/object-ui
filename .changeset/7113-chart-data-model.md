---
'@object-ui/types': minor
---

`ChartSchema` declares the data model it renders — chart-level `data` and `xAxisKey`, with
the bare-string `xAxis` folded onto the latter — and `ChartDataSeries` accepts both binding
dialects (objectui#7113 option B, 项目总监席 总监批 #28 2026-09-01 「同意」; and
objectui#6939's `chart` row, maintainer ruling 2026-09-02 「同意」 — both rulings
independently instructed declaring these two keys, so they land as one change).

⚠️ Shipped as `minor`, not `patch`, because two document classes that validated before now
REFUSE. objectui#6939 grades this class "patch where the accept set only widens toward what
already renders"; this change is not a pure widening, so it takes the level objectui#6896
set for the same transition in this same file — the mirror starting to refuse — and for the
same reason: this repository's `major` is a cross-repo pin to `@objectstack`'s major rather
than a severity dial, so the break is announced here, which is the channel that carries it.

## What now refuses (the narrowing, named)

Both were previously accepted, unchecked, and drew an EMPTY CHART in silence — they
survived only on `BaseSchema`'s `.passthrough()`:

```jsonc
{ "type": "chart", "chartType": "bar", "data": "oops" }      // now: data — expected array
{ "type": "chart", "chartType": "bar", "xAxisKey": 123 }     // now: xAxisKey — expected string
```

Rows that are not objects (`data: [1, 2, 3]`, the shape of the inline model retired by
objectui#6896) are likewise refused, at `data.0`.

## What now validates (the widening)

`series: [{ dataKey: 'revenue' }]`. `normalizeSeries` reads
`str(raw.dataKey) ?? str(raw.name)`, so `dataKey` alone has always been a complete binding
— but the mirror REQUIRED `name` and refused it. That is why both catalog chart fixtures
(`advanced-line-chart.json`, `area-chart.json`) failed validation: they are the `chart: 2`
entry in `objectui check`'s 28-file census. `name` is now optional, `dataKey` is declared,
and a series binding to NEITHER is refused by name at `series.N.name` — the same path the
required flag used to report, so the diagnostic did not move.

## `xAxis` folds; it does not become a second name

`xAxis: 'month'` is accepted at input and is ABSENT from the output, having landed on
`xAxisKey`. When both are written the canonical key is kept and the alias dropped — not a
precedence rule minted here, but the one already running at `normalizeChartSchema.ts:292`,
where `xAxisKey` is the first limb of `str(schema.xAxisKey) ?? xAxisSpec?.field ??
str(xAxisRaw)`. No chart that renders today changes what it renders.

⚠️ The `xAxis` **config object** (`{ field, format, title, showGridLines }`) is NOT folded.
Only the bare string is a sibling spelling of `xAxisKey`; the object's presentation keys
survive separately into `out.xAxis` (`normalizeChartSchema.ts:289-291`), and folding it
would discard them.

## Not done, deliberately

objectui#6939's `chart` row also says "`series[].data` stops being required". On this base
it already is not: objectui#6896 replaced it with `retirementTombstone(...)` —
`z.never({ error }).optional()` — which is optional AND refuses any authored value by name.
Implementing the clause literally would re-widen a retired key and reverse a landed ruling,
so it is not done.

## FROM → TO

```ts
// ChartDataSeries
- name: string;
+ name?: string;
+ dataKey?: string;

// ChartSchema
+ data?: Array<Record<string, any>>;
+ xAxisKey?: string;
```
