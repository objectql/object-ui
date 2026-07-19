---
"@object-ui/plugin-grid": patch
"@object-ui/fields": patch
"@object-ui/plugin-detail": patch
---

fix(list): route remaining system-field groupings through the shared classifier

Follow-up to the `owner_id` default-column fix: consolidate the display-oriented
system-field exclusions onto the shared `isSystemManagedField` /
`SYSTEM_MANAGED_FIELD_NAMES` (from `@object-ui/types`) so the framework-injected
`owner_id` is treated consistently across the grid, record picker, and detail
drawer.

- `ObjectGrid` record-detail drawer: the business-fields vs. muted meta-section
  split now uses the shared classifier, so `owner_id` (and other injected system
  fields) land in the meta section instead of the business body.
- `deriveLookupColumns` (record picker): drops its local name set for the shared
  classifier — now flag-aware (`field.system`), not just name-based.
- `RecordDetailDrawer`: its default `systemFields` set is derived from the shared
  `SYSTEM_MANAGED_FIELD_NAMES`; the `systemFields` prop override is preserved.

`deriveRelatedLists`' narrow "audit FK on every object" set and plugin-detail's
inline-edit "never editable" set are intentionally left distinct — different
semantics (the latter deliberately keeps `owner_id` editable).
