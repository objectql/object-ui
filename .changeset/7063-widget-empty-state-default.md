---
'@object-ui/plugin-dashboard': minor
'@object-ui/i18n': minor
---

Dashboard/analytics widgets get a self-explaining DEFAULT empty state, stated
once for the surface (objectui#7063).

Maintainer ruling 2026-08-31 (hotcrm#1212, following hotcrm#1203): a widget that
renders a bare row-placeholder on an empty result is the PLATFORM's defect and
must be fixed uniformly — apps must not compensate widget by widget
(objectstack#13848). The measured scenario is a fresh flagship-demo install:
eleven populated tiles and one reading exactly `暂无数据行` mid-page, which reads
as "the dashboard failed to load" even though the widget, its declaration and
its (not yet produced) data are all legitimate.

- New `WidgetEmptyState` is the seam the three dashboard surfaces now share.
  There was no shared placeholder to fix: `DatasetWidget` wrote
  `dashboard.noRows`, while `ObjectDataTable` and `PivotTable` wrote
  `dashboard.noDataAvailable` — three renders, two strings, no common code.
- The default now reads as a STATE, not a failure: `role="status"` (the empty
  branches previously carried no role at all, while the failure branches beside
  them are `role="alert"`), muted treatment with an inbox glyph rather than a
  warning triangle, and a title plus an explanation where the placeholder was a
  single terse fragment.
- It names WHAT is empty with zero authored copy — the widget's data source,
  which is the half the reader cannot already see (the tile's title is rendered
  by the card header directly above). That is `widget.dataset` on the dataset
  path and `schema.objectName` on the object-bound table/pivot; `PivotTable`
  takes it as a new optional `sourceLabel` prop, which `ObjectPivotTable`
  forwards.
- Copy is platform i18n: `dashboard.empty.title` / `.message` / `.sourceLabel`
  added to `en` and all nine sibling packs. No inline `defaultValue` and no
  interpolation — the source renders as a labelled value, so no separator is
  concatenated in code and every pack spells its own punctuation.

No new authoring obligation and no new spec key. Note that the `emptyState`
override the card assumes for this surface does not exist: `emptyState` is a
LIST-view contract, and `@objectstack/spec`'s `DashboardWidgetSchema` declares no
such key — so there is nothing here for an author to override, and adding one
would be a contract question rather than a rider.
