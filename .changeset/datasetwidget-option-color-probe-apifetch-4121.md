---
"@object-ui/plugin-dashboard": patch
---

`DatasetWidget`'s option-color / dimension-label probe now rides the host's
authenticated fetch (`SchemaRendererContext.apiFetch`) instead of the bare global
`fetch`.

The one metadata read the effect makes — `GET /api/v1/meta/object/{object}` — went
out on the global `fetch`, so in a hosted console it skipped whatever the host
supplies on that channel (Authorization / tenant headers, base-URL rewrite,
draft-preview params). A bearer-token session carries its credential in a header
rather than a cookie, so `credentials: 'include'` alone left this read
unauthenticated. The effect is best-effort and swallows every failure, which made
the symptom silent: a dataset chart's semantic per-category colors and its
dimensions' value → label maps simply never applied, and the widget fell back to
the positional theme palette and the raw stored values on the axis.

Standalone embeds are unaffected — with no provider (or a provider that supplies no
`apiFetch`) the probe still uses the global `fetch`, the same documented fallback
`useRecordEditable` and `provider: 'api'` view sources use.

This is the `plugin-dashboard` twin of the same fix made to `plugin-charts`'
`ObjectChart`.
