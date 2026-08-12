---
'@object-ui/plugin-detail': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-designer': patch
---

Six i18n keys no longer render as raw key strings on hosts with no `I18nProvider` (objectui#4396)

`detail.saving`, `list.resetSortToDefault`, `appDesigner.widgetProperties`, `appDesigner.addWidget`, `appDesigner.modeEdit` and `common.delete` were read through `createSafeTranslation` without a row in their hook's defaults table and without an inline `defaultValue` at the call site — the only two fallbacks that path has. On a provider-less host (standalone embedding, the preview gallery, host apps that never mount a provider) `fallbackT` therefore returned the key itself, so users saw `detail.saving` in the inline-edit save button, `list.resetSortToDefault` on the sort popover's reset control, `appDesigner.widgetProperties` as the dashboard inspector heading, `appDesigner.addWidget` as its toolbar label, `appDesigner.modeEdit` as a button's accessible name, and `common.delete` on the designer's destructive confirm.

Each key now has a row in its consumer hook's defaults table, byte-identical to the `en` pack value. No pack was edited, no key added, no call site changed.
