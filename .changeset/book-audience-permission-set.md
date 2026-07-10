---
'@object-ui/app-shell': minor
---

Book audience mirrors the spec's permission-set gate (ADR-0090).

`@objectstack/spec` renamed the gated arm of `BookAudience` from
`{ profile: string }` to `{ permissionSet: string }` — ADR-0090 D2 removed
the Profile concept, and D9 makes the gate a capability reference (a
permission-set name the reader must hold, e.g. `crm_admin`). Updated the
three mirrors: the metadata-admin default JSON schema (`book.audience`
`oneOf`), the `BookPreview` audience chip, and the book list-column
renderer. One-step rename, no alias, matching the spec's launch-window
discipline.
