---
"@object-ui/components": patch
"@object-ui/i18n": patch
---

fix(data-table): surface inline-edit save failures instead of swallowing them

A rejected inline-edit save (e.g. a 400 validation failure like an invalid
status transition) was caught with only `console.error` — the toolbar stayed
stuck, the cell kept the unsaved value, and the author got no feedback. Now the
data-table shows the server's reason in the toolbar (with an alert icon) and
tints the affected row(s) destructive so it's clear which rows didn't persist.
The pending edit is kept for retry; the error clears on a successful save or on
cancel. Adds the `table.saveFailed` string across all locales.
