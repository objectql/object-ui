---
'@object-ui/plugin-dashboard': patch
---

A client i18n bundle sub-caption now reaches a DATASET-BOUND KPI tile
(objectui#8889).

`{ns}.dashboards.{dash}.widgets.{id}.subCaption` had two consumers and only one
of them worked on a dataset-bound widget. objectui#7293 taught `DatasetWidget`
to render the AUTHORED value (`widget.options.description`), which also carried
the server path — `translateDashboard` overlays the resolved translation onto
that very key, so a platform-served dashboard arrived pre-translated. But the
limb where a bundle entry OVERRIDES the authored value needs the dashboard name,
and neither dispatch site handed the component anything but `widget` and
`dataSource`.

The visible effect: a dashboard loaded from an app bundle, whose sub-caption was
written only in the i18n bundle and not as `options.description`, rendered
nothing on a dataset-bound tile — a shape the field's own documentation calls
legitimate ("A translation with no authored counterpart is legitimate and
matches the server"). A tile that declared both rendered the untranslated
authored string instead of the translation.

The resolution now happens once, in a new `useWidgetSubCaption` hook, and BOTH
dashboard surfaces (`DashboardRenderer` and `DashboardGridLayout` — both route a
dataset-bound widget to the same component, objectui#4614) pass the resolved
answer down. One decision point, because the field's invariant is that its two
channels can never disagree.

**No behaviour changes for a tile that declares no bundle entry.** The authored
limb is untouched, an inline per-locale map still collapses through the same
`pickLocalized` seam, and a tile with neither channel still grows no caption
node at all. `DatasetWidget` rendered outside a dashboard surface resolves the
authored limb for itself exactly as before.
