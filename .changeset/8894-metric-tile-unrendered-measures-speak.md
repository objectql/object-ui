---
'@object-ui/plugin-dashboard': patch
---

A dataset-bound metric tile now warns when it drops measures it was told to show
(objectui#8894).

`values` is `z.array(z.string()).min(1)` on `DashboardWidgetSchema`, so declaring three
measures on a `metric` / `kpi` / `gauge` / `solid-gauge` / `bullet` widget — or on any
widget with no dimensions — has always been legal, and the query has always run all
three. `DatasetWidget`'s metric branch then rendered `values[0]` and stopped, in
silence: no warning, no console message, no visual tell. A tile answering a narrower
question than its metadata asked read as a finished product, which is the hard part of
the defect — not the two numbers that never appeared. That is the ADR-0049
declared-but-unenforced shape, closed here the same way `warnSuppressedListNav`
(ADR-0047, objectui#2338) closes it for a suppressed list-view control.

**Nothing renders differently.** The tile's markup is byte-for-byte what it was, the
measures after the first are still dropped, and a widget declaring exactly one measure —
the shape of every metric tile in the measured corpora (176 in this tree, 168 in
`objectstack`, against zero multi-measure ones) — says nothing at all. Rendering
`values[1..]` would give those entries authoring semantics they do not have today; it is
tracked separately on objectui#8894 and is not part of this change.

The message names the widget, its dataset, the measure that won, and each measure that
did not. Its wording is deliberate: the dropped measures are **queried and then never
displayed**, not "ignored". They are computed by the server, they join the widget's
refetch signature, and `options.sortBy` accepts any of them — which on a `metric`-typed
widget that also declares dimensions decides which row is read. Only the display drops
them.
