---
"@object-ui/plugin-dashboard": patch
---

Dataset-bound metric cards honour their declared `colorVariant` (objectui#3359, objectstack#5010 ruling B)

`DashboardWidgetSchema.widgets[].colorVariant` has been spec-declared, offered by
every authoring surface (the widget inspector, the dashboard editor, the config
panel) and authored **16 times** in shipped metadata — `system_overview` ×7 in
`platform-objects`, app-showcase's `ops-dashboard` / `revenue-pulse` ×9 — with
every one of those a `type: 'metric'` widget bound to a dataset. None of them
ever rendered a colour.

The reason is structural rather than a missing branch: `dataset` is **required**
on `DashboardWidgetSchema`, so every legal widget reaches `DatasetWidget` through
one of `DashboardRenderer`'s two dispatch sites, and `DatasetWidget` read the key
nowhere. Only the inline (`object` + `valueField`) path had a colour affordance,
via the `...options` spread into `MetricWidget` — a path the current schema
cannot produce. Declared, authored, offered in the designer, and inert: the
renderer painted all sixteen the same.

The metric card now maps the declaration onto the accent system this package
already has, instead of a second one:

- the vocabulary is the spec's `WidgetColorVariantSchema` enum, read from the
  spec **in a test** rather than restated in prose — `default`, `blue`, `teal`,
  `orange`, `purple`, `success`, `warning`, `danger`;
- the accent lands on the big number, the way `MetricWidget`'s chrome-less
  `bare` layout carries it, because a dataset-bound metric renders no icon chip
  and no card of its own. A dataset-bound KPI and an inline `bare` KPI declaring
  the same variant now read the same;
- the two class tables both layouts use moved into one shared module
  (`colorVariants.ts`) rather than being copied — the designer's swatch picker
  already calls itself a mirror of "the renderer's colorVariant tokens", and a
  second copy of a palette is how a declared-but-unenforced key becomes the
  harder bug: a key declared two disagreeing ways.

Nothing changes for a widget that declares no `colorVariant`: its markup is
pinned byte-for-byte against the pre-change render, as is the enum's own
`'default'` (its name for "no accent"). Off-spec tokens — including the swatch
picker's three display-only aliases `green` / `red` / `amber`, which exist so a
legacy stored value can still be drawn as a swatch — get no accent and no
aliasing here: the spec enum rejects them where metadata is authored and
published, and teaching the renderer a second spelling would hand AI-authored
metadata a dialect the contract does not have.
