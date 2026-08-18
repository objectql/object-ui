---
'@object-ui/fields': patch
---

Lookup "recently used" now obeys the field's declared filters. The recents rail
re-fetched its rows without merging either `lookupFilters` or the `dependsOn`
cascade, so a record the author's metadata excludes stayed visible and
selectable — pick a product under project A, switch the form to project B, and
project A's product was still offered. Both re-fetch channels are fixed: the
inline dropdown (which re-read each remembered id with an unfiltered `findOne`)
and the search-first picker (which batched recents into an unfiltered `$in`
query). The currently-selected value still resolves unfiltered, so an existing
value keeps its label and a selection tray is never silently emptied.
