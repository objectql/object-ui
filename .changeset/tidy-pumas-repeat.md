---
---

Catalog-scoped ratchet on deprecated component types (`div` / `span`) in
`examples/schema-catalog`. Test-only: no published package's source changes, so
this declares "no release" explicitly rather than bumping anything.
`@object-ui/example-*` is in the changeset `ignore` list, and
`scripts/check-changeset-presence.mjs` reports "No source of a released package
changed in this range, so no changeset is owed" — this file is the declaration,
not a version bump.
