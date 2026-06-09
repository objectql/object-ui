---
"@object-ui/plugin-list": patch
---

fix(plugin-list): translate ListView empty-state title and message

The empty-state heading and body in `ListView` hardcoded their English fallback (`'No items found'` / `'There are no records to display. Try adjusting your filters or adding new data.'`) instead of going through the i18n `t()` helper like every other label in the component. As a result the empty state always rendered in English even when the active locale (e.g. `zh-CN`) had translations.

Route the fallbacks through `t('list.noItems')` / `t('list.noItemsMessage')`. A user-supplied `schema.emptyState.title`/`message` still takes precedence; only the default text now localizes. The translation keys already exist in every shipped locale, so no new strings are needed.
