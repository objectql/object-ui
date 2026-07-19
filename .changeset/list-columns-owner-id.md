---
"@object-ui/types": patch
"@object-ui/plugin-grid": patch
"@object-ui/app-shell": patch
---

fix(list): keep the injected `owner_id` out of the leading auto-derived columns

A view-less object's default list columns are derived from the object's field
order. The framework's `applySystemFields` spreads its injected
system/audit/ownership fields to the FRONT of that order and stamps them
`system: true`; `owner_id` is deliberately non-hidden and non-readonly
(ownership is reassignable), so the old name-based exclusion lists in
`ObjectGrid` and `InterfaceListPage` — which never listed `owner_id` — let it
through as column #1 on many showcase list pages (e.g. `showcase_field_zoo`).

Default-column derivation now classifies system fields via the shared
`isSystemManagedField` helper, which branches on the spec `system` flag (the
single source of truth stamped by the registry) with a name-set fallback that
includes the ownership/tenancy FKs. `owner_id` is pushed to the end
(`ObjectGrid`) / excluded from the business columns (`InterfaceListPage`), so
auto-derived lists lead with business fields again and pick up future injected
fields without editing a name list. Also declares the `system` flag on the
`@object-ui/types` field metadata.
