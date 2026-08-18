---
'@object-ui/plugin-dashboard': patch
'@object-ui/i18n': patch
---

A KPI card's sub-caption now translates from its own convention key

objectui#4032 item 4. The metric card renders two authored strings, and they
are two different authored fields:

| authored field        | rendered as             | bundle key                                |
|-----------------------|-------------------------|-------------------------------------------|
| `widget.description`  | the shared card header  | `dashboards.<d>.widgets.<id>.description` |
| `options.description` | the KPI sub-caption     | `dashboards.<d>.widgets.<id>.subCaption`  |

Only the first resolved. The metric dispatch spread `...options` straight
through, so the sub-caption reached `MetricWidget` as the raw authored English
and a `zh` dashboard showed a translated header above an untranslated caption.

They get two keys, not one — the objectstack#5428 item-4 ruling (2026-08-06):
"两个作者字段两个 key". That is why PR #4358 landed items 1-3 and deliberately
stopped here: at the time `@objectstack/spec` accepted no segment for the
sub-caption and the only key it would take was `description`, the shared key the
ruling forbids. objectstack#8056 added `subCaption` to the widget translation
node, and it ships in `@objectstack/spec@17.0.0` — the version this repo pins.

The server half already existed: `translateDashboard` overlays `subCaption` onto
`options.description` on the `/meta` path, so a served document was already
correct. This is the client half — the same key path, for the app bundles
objectui loads into `I18nProvider` itself.

- `@object-ui/i18n` gains `widgetSubCaption(dashboardName, widgetId, fallback?)`,
  mirroring `widgetDescription` limb for limb rather than re-implementing
  namespace discovery inside the plugin.
- `DashboardRenderer`'s `tWidgetSubCaption` composes the two channels in the
  order `tWidgetTitle` already fixed — the authored value is collapsed to the
  active language first (an inline per-locale map, the `pickLocalized` seam),
  and the plain string that falls out is offered to the bundle as its fallback —
  so a bundle entry always wins over an inline map, and neither channel is
  replaced by the other. The resolved value is assigned after the `...options`
  spread in both the `object-metric` and static-value branches.

The separation is pinned in both directions, because a shared key is exactly
what a later tidy-up would reach for: the `description` key never reaches
`options.description`, and `subCaption` never reaches `widget.description`. On a
`kpi` / `gauge` / `bullet` widget both are on screen at once, so one shared key
would make a single translation entry overwrite the other field's text.

Untranslated dashboards are unchanged: with no bundle entry the resolver hands
back exactly what the spread would have, and with nothing authored and nothing
translated it answers `undefined` rather than `''`, so a card that has no
sub-caption grows no caption row.
