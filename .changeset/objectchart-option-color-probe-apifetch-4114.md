---
"@object-ui/plugin-charts": patch
---

`ObjectChart`'s category option-color / dimension-label probe now rides the host's
authenticated fetch (`SchemaRendererContext.apiFetch`) instead of the bare global
`fetch`.

Both metadata reads the effect makes — `GET /api/v1/meta/dataset/{dataset}` and
`GET /api/v1/meta/object/{object}` — went out on the global `fetch`, so in a hosted
console they skipped whatever the host supplies on that channel (Authorization /
tenant headers, base-URL rewrite, draft-preview params). A bearer-token session
carries its credential in a header rather than a cookie, so `credentials: 'include'`
alone left these two reads unauthenticated. The effect is best-effort and swallows
every failure, which made the symptom silent: semantic option colors and dataset
dimension labels simply never applied, and the chart fell back to the positional
theme palette and raw stored values.

Standalone embeds are unaffected — with no provider (or a provider that supplies no
`apiFetch`) the probe still uses the global `fetch`, the same documented fallback
`useRecordEditable` and `provider: 'api'` view sources use.
