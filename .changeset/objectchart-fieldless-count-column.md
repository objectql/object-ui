---
"@object-ui/plugin-charts": patch
"@object-ui/data-objectstack": patch
---

fix(charts): a fieldless `count` aggregate keyed its value column `undefined`, so the chart plotted nothing (framework#3701)

framework#3701 pinned down what an OBJECT-bound chart aggregate names its result
columns — the raw field names it was given (`groupBy` for the category, `field`
for the value; no `sum_`-style decoration, unlike a dataset measure), plus the
literal `count` when a `count` omits `field`, which is the alias the engine
projects `COUNT(*)` under. `os validate` now lints page sources against that
convention, so the paths that build these rows have to honour it exactly.

Three of the four did. The odd one out was `count` — the one function that may
legitimately omit `field` — because every row builder read `params.field`
directly:

- `aggregateRecords` / `ObjectDataSource.aggregateClientSide` emitted
  `{ [groupBy]: key, [undefined]: value }`, i.e. a column literally named
  `undefined` that no axis binding could ever name;
- the legacy analytics path was worse: it remapped the server's `count` measure
  onto `params.field` and **deleted** the original key, so the value the server
  did return was thrown away before the chart saw it.

All of them now resolve the column through one helper (`aggregateValueKey`) so a
fieldless count lands under `count`, matching the framework contract. The
comparison-overlay column is derived from the same key (`count__comparison`
instead of `undefined__comparison`), and `aggregate.field` is typed optional to
match the spec's `ChartAggregateSchema`. Charts that name a field are unchanged.
