---
'@object-ui/app-shell': patch
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

Stop the report config panel being titled "Title", and the view-settings colour section "Color"

Two call sites asked for a key whose value was written for a different slot, so the rendered copy was wrong (objectui#4118, surfaced by objectui#3810's census).

`ReportConfigPanel` used `report.editor.title` for both its heading and the accessible name of its `role="complementary"` landmark. That key is the label of the report's Title *field* — `report.editor.titlePlaceholder` ('e.g. Pipeline by Quarter') sits directly under it in the pack. So the panel was headed "Title", and a screen reader announced a complementary region named "Title", which says nothing about what the region is. A new `report.editor.panelTitle` ('Edit report' — what the call site's own dead fallback said before objectui#3810 aligned it to the pack) now names the panel, in all ten locale packs.

`ViewSettingsPopover`'s colour section used `list.color`. On the wide toolbar `ListView` already uses both keys correctly for the two slots of this one feature: the compact `Paintbrush` button is `list.color` ('Color') and the panel it opens is headed `list.rowColor` ('Row Color'). This popover is that same panel on the collapsed/`compactToolbar` surface, so it now takes `list.rowColor` — an existing key, no pack change.

No `en` value of an existing key changed; `scripts/check-i18n-en-drift.mjs` reports 0 en values changed, 1 key added.
