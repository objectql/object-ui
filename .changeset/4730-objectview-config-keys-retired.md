---
'@object-ui/i18n': patch
---

The `console.objectView.*` config-panel vocabulary is retired — 116 keys removed from each
of the ten packs, 1160 translated strings that nothing read (objectui#4730, maintainer
ruling 2026-08-19).

The namespace held 209 keys per pack. 116 of them labelled a view-configuration settings
panel that does not exist: appearance and density toggles, accessibility attributes,
conditional-formatting rules, row-action and inline-edit switches, quick-filter builders,
an advanced-settings tier. `packages/app-shell/src/views/ViewConfigPanel.tsx` — the panel
they were written for — was migrated off the legacy `buildViewConfigSchema` engine onto
`ViewVariantInspector`, a spec-driven inspector whose field labels come from
`@objectstack/spec` metadata rather than from this namespace. The panel was replaced; the
keys were not cleaned up with it.

Removed under objectui#4658's three-legged evidence standard, re-measured on this branch's
merge base rather than inherited from the card: zero `t()`/`tt()` call sites, zero textual
occurrence of the dotted key anywhere in the repo outside the packs that define it, and a
consumer spot-check confirming no i18n wiring. The 93 live keys stay — the create-view
dialog fields, the view-type catalogue, `new`/`save`/`cancel`, the object-not-found copy,
plus the 38 keys whose spelling still appears somewhere the AST pass cannot see, which are
out of scope here.

Four of the retired keys name `ListViewSchema` properties that are still active —
`rowActions`, `inlineEdit`, `hiddenFields`, `filterableFields`. They are retired anyway, by
the ruling's own words: a live schema property is not a consumer of a locale string; only a
labelled UI control is. If such a panel is ever specified, its keys are re-authored
alongside it.

`packages/i18n/src/__tests__/objectView-config-keys-retired-4730.test.ts` pins the removal
by name. Every i18n gate in this repo runs call site → key, so none of them can see a dead
key come back: the parity gate is fully satisfied by 116 dead keys present in all ten packs,
and the reverse sweep that found them (`scripts/check-i18n-dead-keys.mjs`) is report-only by
design. The pin is the only thing that would notice.
