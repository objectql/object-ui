---
'@object-ui/plugin-detail': patch
---

Localize `RecordDetailDrawer`'s drag-resize handle (objectstack#5733)

`packages/plugin-detail/src/RecordDetailDrawer.tsx` carried a byte-identical twin
of the literal objectstack#5506 removed from `NavigationOverlay`: a
`role="separator"` drag handle on the drawer's left edge with a hardcoded
`aria-label="Resize drawer"`. #5506's sweep fenced on `packages/components`, so
this second copy survived it.

The handle has no visible label, so that string IS the control as far as a
screen reader is concerned — a zh/ja/de session got one English announcement in
an otherwise localized drawer. It is not a dormant branch either: `resizable`
defaults to `true`, and the drawer is what plugin-kanban / plugin-calendar /
plugin-gantt open on row, card and event click.

It now reads `t('common.resizeDrawer')` — deliberately the SAME key #5506 gave
the other handle (already present in all ten locale packs) rather than a new
`detail.resizeDrawer` twin, so one control rendered from two packages cannot end
up with two translations that drift apart.

`common.resizeDrawer` is also added to `DETAIL_DEFAULT_TRANSLATIONS`, the map
`createSafeTranslation` falls back to when no `I18nProvider` is mounted. Without
that entry the name would degrade to the raw key for every provider-less host —
which is the regression the accompanying no-provider test pins.
