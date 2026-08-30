---
"@object-ui/app-shell": patch
---

`provisionProductionEnvironment` reads the created env from the nested `environment` row

`POST /api/v1/cloud/environments` answers `{ success, data: { environment, warnings,
durationMs, hostnameAssignment? } }` — the created row sits one level down, under
`environment`. The consumer read `data` FLAT and returned it as a
`ProvisionedEnvironment`, so `id` and `hostname` were always `undefined` and the
envelope's siblings rode along in their place.

The bug was silent by construction: both fields are optional on the type, the whole call
is best-effort by contract (a 403/409 resolves to `alreadyProvisioned: true`) and the
caller swallows genuine failures — so the function reported a successful provision
carrying no environment at all, which is the exact outcome the strict envelope check in
that file was written to prevent. That check verifies `data` is an object and nothing
about its shape.

The fix reads ONE dialect: no `data.environment ?? data` alias, and the row is projected
to `{ id, hostname }` rather than returned whole. A wrong-shaped `data` still RESOLVES
rather than throws — tightening the envelope check to reject it would change behaviour on
the best-effort path the caller relies on swallowing, and is deliberately not folded in
here.

Scored `patch`, not an empty "no release" declaration: this is shipped runtime code in a
published package whose return value is different, not a comment or a test-only change,
so an empty frontmatter would assert something false. Not `minor` — no new capability and
no API surface change; `ProvisionedEnvironment` is unchanged. The blast radius is small
today (the sole in-repo caller, `CreateWorkspaceDialog`, discards the return value, and
the symbol is not on the package barrel), but "small" is not "unreleased".
