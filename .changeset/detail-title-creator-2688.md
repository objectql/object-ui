---
"@object-ui/plugin-detail": patch
---

fix(plugin-detail): #2688 — record surfaces without a caller title no longer floor to `Record #<id>`, and the meta footer never prints a raw audit user id

- `DetailView` header: after every declared-identity step misses and no
  `schema.title` was provided, probe name-ish record keys (`name`, `title`,
  `*_name`, …) before falling to the `Record #<id>` floor. Fixes records whose
  name lives in a field the type-aware derivation deliberately skips (e.g. an
  `autonumber` `name`) opened from surfaces like the gantt row drawer.
- `RecordMetaFooter`: `created_by` / `updated_by` are always user references on
  ObjectStack — when the fetched schema omits the audit system fields, default
  the reference target to `sys_user` so the footer renders a resolved user name
  (or the muted placeholder) instead of the raw opaque id.
