---
"@object-ui/data-objectstack": patch
"@object-ui/app-shell": patch
---

fix(studio): surface spec-validation failures on the field at save/publish

When a Studio metadata draft failed spec validation, the designer got a single
opaque banner (and, on a partial publish, a false "published!" toast) — the
server was already returning field-anchored issues, but the client threw them
away. Two problems, both fixed:

- **`parseError` (data-objectstack)** read `String(body.error)`, which yields
  `"[object Object]"` for the dispatcher's object-shaped error, and ignored the
  validation `issues`. It now reads the message from either shape (string or
  `{ message }`) and exposes `MetadataError.issues`, accepting all live server
  shapes — top-level `body.issues` (REST server) and `error.details.issues`
  (HTTP dispatcher).

- **Studio save/publish (app-shell)** now render those issues **field-anchored**.
  A new `formatMetadataError` helper turns a caught error into one line per
  offending field (`• fields.amount.type — Invalid option: …`); the save banners
  render it with `whitespace-pre-line`. `doPublish` no longer claims success when
  the response carries `data.failed[]` — it lists which drafts failed and why
  (the server returns 200 with the failures buried, so the UI used to swallow
  them). `formatPublishFailures` formats those per-draft.

Verified end-to-end against a live backend: an invalid object draft returns 422
with field-anchored issues, and the Studio banner shows
`• fields.amount.type — Invalid option: expected one of "text"|…` instead of a
generic message. Unit-tested: `parseError` on the dispatcher shape, and the
`formatMetadataError` / `formatPublishFailures` helpers.
