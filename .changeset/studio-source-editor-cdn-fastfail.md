---
'@object-ui/app-shell': patch
---

Studio source-code editors fall back to the textarea instantly when Monaco can't load (offline / air-gapped / CSP).

The metadata designer's code surfaces — the JSON **Source** tab (`JsonSourceEditor`) and the `kind:'html'`/`kind:'react'` page editor (`SourcePageEditor`) — lazy-load Monaco from a public CDN (jsdelivr). On installs that block it (the console is meant to embed in any ObjectStack server, many shipping a strict CSP), the loader script fails and the panel sat on Monaco's own "Loading…" for a hard-coded 4 seconds before the textarea fallback engaged. A new shared `useMonacoFallback` hook now watches `loader.init()` and flips to the textarea the moment the CDN load rejects (~immediately), keeping the previous `.view-line` DOM-poll as a backstop for the "resolved but painted nothing" case. On working networks Monaco still loads normally. This also makes the Studio Interfaces pillar's "edit it directly in the code panel on the left" hint (added in #2285) actually point at a populated editor instead of a stuck spinner.
