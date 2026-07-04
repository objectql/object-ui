---
"@object-ui/app-shell": patch
---

fix(studio): scope the Access rail server-side by package (ADR-0086 P1)

The Access pillar's permission-set rail filtered client-side on a `package_id`
field read from `client.list('permission')` rows. But the metadata list endpoint
does not echo the record-level provenance columns — every row comes back with
`package_id` unset — so the filter's "any set tagged?" guard never fired and the
rail showed **all** sets, including environment-owned platform defaults
(`admin_full_access`, `member_default`, …), in a package's Access panel.

The rail now scopes server-side via `client.list('permission', { packageId })`:
the metadata API filters `permission` by the `package_id` provenance seeded in
framework ADR-0086 P1, returning only the sets this package owns. Verified
against a live showcase backend — the panel lists exactly `showcase_contributor`
and `showcase_member_default`, and the four platform defaults are excluded.

Removes the now-unused `scopePermissionSetList` client-side helper. Object-matrix
scoping and Save slice-merge (ADR-0086 P0) are unchanged.
