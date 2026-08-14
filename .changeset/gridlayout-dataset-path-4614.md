---
'@object-ui/plugin-dashboard': minor
---

The editable dashboard grid renders dataset-bound widgets — and says so visibly when it cannot

`DashboardGridLayout` had no dataset path at all. It never read `widget.dataset`, never imported `DatasetWidget`, and took no `dataSource` prop — so a widget authored the way ADR-0021 says to author them (`{ id, type: 'bar', dataset: 'invoices', values: ['count'] }`) fell straight through to the static-data branch and rendered nothing. Measured on the node the grid handed `SchemaRenderer`, the silence had three flavours rather than the one reported: a `bar` became `{ type: 'chart', data: [] }` (a chart drawn over nothing), a `metric` became `{ type: 'metric', value: '—' }` (an em dash, which reads as a rendered value rather than an error), and a `table` became `{ type: 'data-table', data: [] }`. No data, no diagnostic, no path to fix — on the surface registered as the `dashboard-grid` SDUI component and exported by name from the package entry.

This is the defect objectui#4612 fixed for the RETIRED authoring shape, one level up: same surface, same silence, but the shape that is current. The sibling `DashboardRenderer` has routed these widgets through the governed `queryDataset` path since ADR-0021, so the cure is that surface's own mechanics rather than a second dispatch idiom — the `datasetBound` predicate decided per widget, and `DatasetWidget` picked at the render site.

`DashboardGridLayout` therefore gains an optional `dataSource` prop, forwarded to `DatasetWidget` for dataset-bound widgets. A dataset-bound metric now also takes the shared `Card` wrapper, matching the sibling: `DatasetWidget` renders just the value, so without the card it would show as bare text with no title beside its neighbours.

A dataset-bound widget arriving with NO data source renders a visible state, never a blank. No new placeholder was declared for it: `DatasetWidget`'s own no-capability rendering — an alert reading "This data source does not support dataset queries." — was measured to render visibly when handed no adapter, so routing through it unconditionally cures both halves with one diagnostic and one wording. That case is not hypothetical: `dashboard-grid`'s SDUI registration declares only `title` and `className` inputs, so schema-driven hosts render this component with no adapter at all, and every such host keeps working exactly as before.

Nothing else moves. The objectui#4612 legacy sentinel keeps its position and its verdict — the two conditions are mutually exclusive by construction, since the shared detector returns false the moment a widget carries `dataset` — and static-data widgets, `options.data` provider widgets and legacy-retired widgets all render as they did and never reach the dataset query. The new prop is additive and optional, so existing call sites are untouched.
