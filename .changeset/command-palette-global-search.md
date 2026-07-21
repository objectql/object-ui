---
"@object-ui/data-objectstack": patch
"@object-ui/react": patch
"@object-ui/app-shell": patch
"@object-ui/types": patch
---

Command palette (⌘K) now surfaces record search hits from the platform's global
search endpoint (`GET /api/v1/search`).

Previously the palette only ran a per-object `find({ $search })` fanout (the
metadata-driven ADR-0061 search), which misses records that only the global
search index knows about — so typing a well-known record name returned no
records even though `/api/v1/search` served them. `ObjectStackAdapter` now
exposes a `searchAll(query, { limit, objects })` method that calls the unified
endpoint, `useRecordSearch` prefers it when present (falling back to the fanout
otherwise), and the palette renders the resulting record hits grouped by object.
