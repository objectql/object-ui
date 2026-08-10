---
"@object-ui/plugin-gantt": patch
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-map": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-form": patch
---

`PageComponentSchema.dataSource` now reaches the remaining object-bound public
blocks: `object-gantt` / `object-timeline` / `object-map` / `object-pivot` /
`object-master-detail-form` / `embeddable-form` / `record:line_items`
(objectstack#7121).

objectstack#6953 wired the spec's per-element data binding
(`dataSource: { object, view?, filter?, sort?, limit? }`) to the eight blocks it
named and left the same declaration inert on these seven. Each gates its fetch on
its own object key and nothing mapped `dataSource.object` onto it, so a page
written the way the spec documents rendered an empty gantt / an empty timeline
rail / a map with no markers / an empty cross-tab / a field-less form — with no
request and no diagnostic anywhere. Spec-valid metadata rendering nothing is the
objectstack#4413 shape.

Composition follows objectstack#5576's landed semantics unchanged, through the
shared `ElementDataSourceGate` (no change to it or to the resolution layer): a
named saved view supplies the baseline, a key written on the component itself
overrides it, an explicit binding key overrides both, `filter` AND-combines
("additional filter criteria" — a binding can narrow a view, never widen it), and
a `view` name that does not resolve renders a configuration error on every one of
these blocks instead of degrading to the object's full scope.

Each block maps **only** the keys it genuinely reads, which for this batch means
several keys stay deliberately unmapped rather than being parked somewhere
plausible:

- `object-gantt` and `object-map` take `object` / `filter` / `sort`; neither has a
  row cap or a field-list read site.
- `object-pivot` takes `object` / `filter`; a cross-tab orders itself by its own
  row/column grouping and cannot be computed over a truncated page.
- `object-timeline` takes `object` only — its fetch is
  `find(objectName, { options: { $top: 100 } })`, with no filter/sort read site
  at all, so a named view is error-checked and then contributes nothing.
- `embeddable-form` and `object-master-detail-form` take `object` only (the
  parent object, in the master-detail case); a form that writes one record has no
  collection query for `filter` / `sort` / `limit` to narrow.
- `record:line_items` takes `object` onto **`childObject`** — the collection it
  actually lists — and nothing else: its query is the parent FK plus a fixed
  `$top: 500`, and its `columns` are editable `GridColumn` objects rather than a
  field-name projection a view could supply.

The per-block coverage table, including every residual gap named above, is in
`content/docs/guide/data-source.md`.

No behaviour change for a block that carries no `dataSource`: the binding-free
path returns the schema by reference, so nothing remounts and nothing refetches.
