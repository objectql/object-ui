---
"@object-ui/i18n": patch
"@object-ui/app-shell": patch
---

fix(cloud-connection): localize the Cloud Connection panel (objectstack#3589 follow-up)

`CloudConnectionPanel` — the `cloud-connection:panel` SDUI widget that is the
entire body of the Cloud Connection Setup page — had no i18n at all: no
`@object-ui/i18n` import, and no `cloudConnection` namespace in any of the ten
built-in locale packs. Its siblings on neighbouring pages
(`marketplace:installed-list`, `mcp:connect-agent`) were already fully
localized, so this one page rendered a translated header above an English body
once the framework-side `page:header` resolution landed.

- New `cloudConnection` namespace in all ten packs (en, zh, ja, ko, de, fr, es,
  pt, ru, ar), matching the coverage its sibling namespaces already had. Covers
  every phase of the device-code flow: checking, error + retry, waiting
  (approval prompt, user code, copy), bound (connection detail labels), and
  unbound (call to action).
- The three hard-coded failure messages (expired request, bind failure, device
  code request failure) are translated where they are raised, not where they
  are rendered, since they are stored in component state.
- The "code is pre-filled…" line was one sentence stitched together across JSX
  with a conditional tail and a bare `'.'`. It is now two self-contained
  strings, so a translator never receives a dangling clause whose word order
  they cannot change.
- The `bound_at` timestamp now formats with the active UI language rather than
  the browser default, matching the surrounding copy.

Also adds a locale-parity test asserting the `cloudConnection` key set is
identical across all ten packs — partial coverage degrades quietly, because
i18next falls back to `en` and the result merely looks half-translated.
