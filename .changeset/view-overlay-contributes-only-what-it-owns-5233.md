---
"@object-ui/data-objectstack": patch
"@object-ui/app-shell": patch
---

A view personalization overlay no longer freezes the view it was laid over. `ObjectView`'s
`persistViewPatch` sends `{ ...baseViewDef, ...patch }`, so a row written by a mere column
drag or sort change stored the view's whole body — its effective `filter`, `columns`,
`label`, `type`, `isDefault` — as of that moment, and the display merge
(`{ ...source, ...override }`) then let that snapshot outrank the source view indefinitely:
an admin edited a view's filter and everyone who had ever resized a column silently kept the
old filter, with nothing reporting it.

An overlay now contributes only the keys it owns — `rowHeight`, `sort`, `hiddenFields`,
`columnState`, `inlineEdit` (`VIEW_OVERLAY_OWNED_KEYS`, new export from
`@object-ui/data-objectstack` alongside `narrowPersonalizationOverlay`) — so a later change
to the source view reaches every user, including those whose stored row still carries the
old snapshot: rows written before this change stop shadowing the source on the next read,
with no migration to run and nothing rewritten at rest. A genuine saved view's own body is
untouched — it is classified by the same predicate `listViews()` already excludes overlay
rows by, so a row cannot be an overlay for one reader and a saved view for the other
(objectui#5233, ruled on objectstack#7494).
