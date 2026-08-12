---
'@object-ui/plugin-dashboard': patch
---

KPI cards no longer write their own schema onto the DOM — `MetricWidget` and
`MetricCard` keep `SchemaRenderer`'s schema-shaped props out of the `...props`
spread (objectui#4357).

Both components are two things at once: an SDUI block reached through
`SchemaRenderer`, and a plain React component a host may render directly. The
React half wants a `...props` spread on its root so callers can pass `aria-*`,
`data-*`, `id`, `role`. The SDUI half means that spread also received the node's
own metadata — and React writes unknown lowercase attributes straight to the DOM,
stringifying object values. Every KPI card therefore carried
`schema="[object Object]"`, and a widget authored with events, a binding or a
props container carried `events="[object Object]"`, `bind="data.revenue"` and
`props="[object Object]"` beside it.

Seven props were measured arriving at the call site that are not HTML attribute
names — `schema`, `events`, `props`, `bind`, `ariaLabel`, `ariaDescribedBy` (the
last two are the camelCase authored forms of ARIA the renderer already emits in
their dashed spelling) and `dataSource`. They are destructured out; the spread
survives untouched for everything that IS a DOM attribute: `id`, `name`, `role`,
`disabled`, `aria-*`, `data-*`, `className`. Nothing else about the render moves
— no text, no class, no element.

`dataSource` is the one that only a live dashboard shows. It is not a schema key
(the renderer strips the schema's own `dataSource` binding by name); it is the
injected adapter `DashboardRenderer` hands its `SchemaRenderer` call, which
arrives through the renderer's trailing props. Every fixture in this package
renders without an adapter, so it read `undefined` and wrote nothing — while
every deployment that actually loads data put `datasource="[object Object]"` on
the card. The pin renders a dashboard with an adapter so the case that only
production had is now a test.

The cost of this was never visible; it was that the defect poisoned the
assertion this area attracts. objectui#4163 pins
`not.toContain('[object Object]')` on the dashboard grid, and objectui#4032
wanted the same pin on the metric path but could not write it: the card carried
the attribute before and after any i18n fix, so the container assertion was red
for a reason unrelated to labels and the tempting repair was to loosen it. That
suite asserted on the card heading instead, with a comment. The workaround is
now removed and the container assertion is back.

The exported `MetricWidgetProps` / `MetricCardProps` interfaces are unchanged —
the components' accepted props widen only by the optional, ignored
`SchemaHostProps` keys, so no consumer type narrows.
