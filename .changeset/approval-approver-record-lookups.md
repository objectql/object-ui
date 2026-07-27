---
'@object-ui/app-shell': minor
'@object-ui/fields': patch
---

feat(app-shell): approval approver values become record lookups (framework #3508)

- The flow designer's approver `Value` cell now sources directory kinds from DATA
  records instead of the metadata registry: `user` / `team` / `department` / `position`
  render a single-select record lookup (`LookupField` over `sys_user` / `sys_team` /
  `sys_business_unit` / `sys_position` via the DataSource adapter), with a manual-entry
  escape hatch and a plain free-text fallback when no adapter is available (offline
  preview). `position` commits the machine name; the others commit the record id —
  matching the approval engine's resolution semantics.
- `org-membership-level` is now a strict select (owner/admin/member); a stored
  out-of-enum value renders flagged instead of being blanked.
- `manager` renders as an auto-resolved (disabled) cell; `queue` is no longer offered
  for new approver rows and stored queue rows carry a "not supported by the runtime"
  warning.
- `@object-ui/fields`: `LookupField` hydrates the selected label through `id_field`
  when it is not the primary id (e.g. `id_field: 'name'`), instead of always calling
  `findOne` with the primary id.
