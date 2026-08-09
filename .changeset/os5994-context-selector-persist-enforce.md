---
"@object-ui/app-shell": patch
---

Honour all three `AppContextSelectorSchema.persist` values in app context selectors: `'query'` (the default) writes and reads the URL query parameter only, `'session'` writes and reads `sessionStorage` only, and `'none'` writes neither — the pick stays in memory for that mount. Previously every selector was mirrored into both stores and read back as `URL ?? storage`, so `'session'` and `'query'` were indistinguishable and `'none'` persisted anyway. Selectors on the `'query'` default (including Studio's package scope) no longer write `objectui-ctx-*` storage, and a scope dropped by a param-less nav link is re-established by auto-select-first instead of from a store the author never declared.
