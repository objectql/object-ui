---
'@object-ui/components': patch
'@object-ui/fields': patch
---

Fix dependent (cascading) lookups: unlock on parent selection and enforce the
cascade filter on every candidate surface (#2215).

Two breaks made `depends_on` unusable end to end:

- **The gate never unlocked in create mode.** `LookupField` resolved dependent
  values from `ctx.formValues` — a member `SchemaRendererContext` never had —
  and nothing injected the `dependentValues` prop, so with a fresh record
  (`ctx.data = {}`) the child lookup stayed disabled no matter what the user
  picked in the parent field. The form renderer now injects its live form
  values (the same reactive snapshot that drives field rules) as
  `dependentValues` for data-source fields.
- **The Level-2 table picker bypassed the cascade.** The `depends_on` chain
  only reached the quick-select popover filter; `RecordPickerDialog` (and the
  search-first `PeoplePicker`) received just `lookup_filters`, listing the full
  unfiltered record set. Both pickers now take a `baseFilter` — a hard
  `$filter` constraint merged after `lookupFilters` and user filter-bar input,
  so it can never be widened back out — and `LookupField` passes the dependent
  chain there, shares the same filter with the popover query, and disables the
  browse-all button while dependencies are missing.
