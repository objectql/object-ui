---
"@object-ui/app-shell": patch
---

fix(list): keep the injected `owner_id` out of the auto-generated list columns

`ObjectView` renders an object's default "所有记录" tabular view (and prefills the
"Add View" dialog) from the object's field order when it declares no explicit
list view. Both paths carried their own name-based `SYSTEM_FIELDS` exclusion set
that — like the pre-#2702 lists in `ObjectGrid` / `InterfaceListPage` — never
listed `owner_id`. Because the framework's `applySystemFields` spreads its
injected system/audit/ownership fields to the FRONT of the field map and
`owner_id` is deliberately non-hidden and non-readonly (ownership is
reassignable), it leaked through as the leading, raw-id column on every object
without a declared list view (e.g. `showcase_invoice`), redundant with the
business `owner` (`Field.user`) column.

Both paths now derive their columns through a single shared
`defaultListColumnsFromObject` helper that classifies system fields via the
`isSystemManagedField` helper from `@object-ui/types` (the same classifier
#2702 introduced) — branching on the spec `system` flag with a name-set
fallback that includes the ownership/tenancy FKs. Auto-derived lists lead with
business fields again and pick up future injected fields without editing a name
list. Closes #2777.
