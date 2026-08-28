---
'@object-ui/plugin-list': minor
'@object-ui/app-shell': minor
---

**Behaviour change:** the spec's view-level `map` block on a list view is now read at
runtime. `ListMapConfigSchema` (objectstack#9340) has been authorable and validated since
the `@objectstack/spec` 17.1.0 pin — it flows into this repo's own `ListViewSchema` by
reference — but nothing consumed it: `ListView`'s `case 'map'` forwarded only the legacy
`schema.options.map` bag, so declaring `map: { titleField: 'title', locationField:
'location' }` on a view changed nothing and marker titles fell back to the renderer's
placeholder.

The block now reaches `plugin-map` and drives every one of its seven reads — coordinate
extraction, marker title and description, and the initial camera. Precedence follows the
convention the sibling visualization blocks in the same file already set: the view-level
block wins over `options.map`, per key, exactly as `kanban` / `calendar` / `gallery` /
`timeline` / `gantt` each merge their spec config over the legacy bag. Both sources go
through the existing objectui#5177 key whitelist, and the branch still emits the flat
form, so `getMapConfig`'s objectui#5018 precedence rule ("neither flattener emits a `map`
key at all") stays true.

The visualization switcher had the same gap with a sharper consequence: the capability
gate that decides which visualizations are offered also read `options.map` alone, so a
view binding its coordinates in the spec block was filtered out of its own
`appearance.allowedVisualizations` and fell back to `['grid']`. The gate now asks the same
merged config the render seam forwards, so the two cannot disagree — including for a
binding split across the two sources.

`InterfaceListPage` (ADR-0047 interface pages) forwards the referenced view's `map` block
for the same reason. It is passed alongside the auto-derived `options.map` rather than
replacing it, so a partial authored block — `map: { titleField: 'title' }` — keeps the
derived coordinate binding instead of dropping it.

No defaults are introduced for `zoom` / `center`: an undeclared camera stays undeclared,
so the fit-to-queried-records behaviour ruled in objectui#5000 is unchanged.
