---
"@object-ui/plugin-grid": patch
---

fix(grid): bulk-action params render the shared form field widgets — a failed lookup fetch shows an error + Retry instead of a permanent "Loading…" (#3064, ADR-0059)

`BulkActionDialog`'s hand-rolled param controls (a 2026-05 MVP predating the
PeoplePicker and ADR-0059) are replaced by the same field-widget renderer the
object form and `ActionParamDialog` use, via a new pure `bulkParamToField()`
adapter + `getLazyFieldWidget()`:

- `lookup` params get the real searchable `LookupField` (server-side search,
  record-picker dialog, loading/error/empty states owned by `useRecordQuery`);
  a `sys_user` target — or a `user`-typed param — is promoted to the form's
  search-first PeoplePicker (avatar + subtitle rows, recents, banned users
  excluded). Every other param type (date/datetime/boolean/select/multiselect/
  textarea/number/…) renders its form widget too, so param support can no
  longer drift behind the form surface.
- The #3064 failure pipeline is gone by construction: no more eager
  `find($top:200)` prefetch on open, no error swallowed into an empty option
  list rendering as permanent "Loading…", and no per-param failure cache —
  reopening or Retry refetches.
- Preserved semantics: #2204 schema-fallback multi-value detection, required
  gating, #2185 nested-popper dismissal guard, and human-readable confirm-step
  labels (now resolved per selected id via `findOne`, replacing the removed
  candidate prefetch).
