---
'@object-ui/plugin-dashboard': patch
'@object-ui/sdui-parser': patch
---

A dataset-bound KPI tile now renders the sub-caption its author declared in
`options.description` (objectui#7293).

The sub-caption slot was wired end to end and consumed by nothing. It has its own
translation key (`{ns}.dashboards.{dash}.widgets.{id}.subCaption`), the server's
`translateDashboard` overlays that translation onto `options.description`, and
`DashboardRenderer`'s `tWidgetSubCaption` resolves it — but only onto the two
inline arms of `getComponentSchema()`. `dataset` is REQUIRED on
`DashboardWidgetSchema` (published `@objectstack/spec@17.4.0`: the required keys
are exactly `id` / `dataset` / `values`), so every spec-legal widget renders
through `DatasetWidget` instead, which read the key nowhere. Every author who
wrote a sub-caption got silence.

`DatasetWidget`'s metric branch now reads the key and renders it in the caption
row, resolving it through the same `pickLocalized` seam every other authored
label channel uses, so an inline per-locale map resolves instead of being
dropped. A tile that declares no sub-caption renders byte-identical markup.

Read in `DatasetWidget` rather than passed down as a prop on purpose: both
dashboard surfaces (`DashboardRenderer` and `DashboardGridLayout`) route a
dataset-bound widget to that one component, so a prop from one dispatch site
would have fixed one surface and left the other unchanged.

`@object-ui/sdui-parser` carries no behaviour change — its `unconsumed-widget-option`
census recorded `description` as accepted *despite* having no read site on the
dataset-bound path, and that note is now stale prose.
