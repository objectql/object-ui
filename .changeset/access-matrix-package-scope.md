---
"@object-ui/app-shell": patch
---

fix(studio): scope the Access matrix by package + slice-merge on save (ADR-0086 P0)

The Access pillar embedded the permission matrix at **environment scope**: it
listed every object in the environment (the "84-object leak"), and Save
overwrote the whole permission set — silently dropping authorization rows other
packages had contributed.

Opened inside a package, the matrix now:

- lists **only the objects that package declares** (`list('object', { packageId })`),
  so a package's Access panel no longer exposes unrelated objects; and
- saves via **slice-merge** — it re-reads the record and writes back only this
  package's slice, leaving every row contributed by other packages
  byte-for-byte intact.

The Access rail also hides environment-owned platform-default sets
(`admin_full_access`, `member_default`, …) from a package's panel once the
backend tags sets with a record-level `package_id` (framework ADR-0086 P1), with
a mid-migration guard that shows all sets until that provenance axis is live so
the rail never goes empty. Behavior is unchanged when the editor is used outside
a package (no `packageId`): full object list, whole-record save.
