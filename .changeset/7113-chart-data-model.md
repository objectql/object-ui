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

**Three** classes validated before and refuse now. The first two survived only on
`BaseSchema`'s `.passthrough()`; the third was silently STRIPPED by the non-strict
`ChartDataSeriesSchema` object.

```jsonc
// 1. chart-level `data` that is not an array of row objects
{ "type": "chart", "chartType": "bar", "data": "oops" }   // now: [data] expected array
{ "type": "chart", "chartType": "bar", "data": [1,2,3] }  // now: [data.0] expected object

// 2. a non-string `xAxisKey`
{ "type": "chart", "chartType": "bar", "xAxisKey": 123 }  // now: [xAxisKey] expected string

// 3. a non-string `series[].dataKey`  ⚠️ THIS ONE DRAWS A REAL CHART TODAY
{ "type": "chart", "chartType": "bar",
  "series": [{ "name": "a", "dataKey": 123 }] }           // now: [series.0.dataKey] expected string
```

⚠️ **Class 3 is the sharp one and is called out separately.** Classes 1 and 2 are malformed
documents whose chart was already broken. Class 3 is not: at base it parsed to
`series: [{ name: 'a' }]` (the non-string `dataKey` stripped in silence) and
`normalizeChartSchema` renders it — `str(123)` is `undefined`, so the read falls back to
`name` and yields `series: [{ dataKey: 'a' }]` (`normalizeChartSchema.ts:239`). So this is a
narrowing away from a document that **renders today**, which is precisely the distinction
objectui#6939's grading language turns on. `dataKey: null` behaves identically. Measured on
both states; the declaration itself is right, and this note is the disclosure it was owed.

## Corrected: what class 2 actually did

An earlier draft of this changeset said `xAxisKey: 123` "drew an EMPTY CHART". The read
sites do not support that: `ChartRenderer.tsx:133` takes `schema.xAxisKey` raw and the rows
still reach `data` at `:164`, while the normaliser drops the key (`str(123)` is `undefined`).
Measured through `normalizeChartSchema`, the result keeps the series and loses only the
category binding — **a drawn chart with a broken category axis**, not an empty one. Class 1
(`data` malformed) is the one that leaves nothing to plot.

## Also changed on the published surface: combinators

Both consts now carry a check (`ChartSchema` the `xAxis` fold, `ChartDataSeriesSchema` the
at-least-one-binding refinement), and on zod 4.4.3 that makes three combinators **throw**
where they previously returned a schema:

```
ChartSchema.pick(…) / .omit(…) / .partial()        -> throws "cannot be used on object
ChartDataSeriesSchema.pick(…) / .omit(…) / …          schemas containing refinements"
```

`.extend()` with a NEW key still works and preserves the fold and the refinement;
`.optional()`, `z.discriminatedUnion`, `z.toJSONSchema` and `safeValidateSchema` are all
unaffected. Nothing in this repository calls the throwing combinators on either const, and
the published surface already ships refined mirrors (`objectql.zod.ts`, `complex.zod.ts`,
`form.zod.ts`, `app.zod.ts`), so the class is not new — but it is a real behaviour change on
a published export and it belongs in the release note rather than in a reviewer's file.

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
