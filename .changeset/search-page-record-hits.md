---
"@object-ui/app-shell": patch
---

The full-page search (`/apps/:app/search`) now surfaces record hits, not just
metadata nav items.

Following the ⌘K command-palette fix (#3371), the search results page was still
matching only navigation entries (objects, dashboards, pages, reports). It now
runs the same global record search (`useRecordSearch` → `/api/v1/search`),
scoped to the app's searchable objects, and renders the record hits grouped by
object above the metadata matches. Both the search page and the palette now
resolve each object group's heading through the i18n label resolver, so
localized object labels display correctly instead of falling back to the raw
object name.
