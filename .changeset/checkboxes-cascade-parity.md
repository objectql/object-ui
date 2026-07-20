---
"@object-ui/fields": minor
"@object-ui/components": patch
---

feat(fields): CheckboxesField per-option `visibleWhen` cascading + `dependsOn` gating (completes the option-widget parity set)

`checkboxes` was the last static-option widget still rendering `config.options`
raw — with no per-option `visibleWhen` filtering, `dependsOn` gating, or cascade
clear. It now matches `MultiSelectField` (its multi-value sibling), completing
the ADR-0058 parity across `select` / `multiselect` / `radio` / `checkboxes`.

- **`@object-ui/fields`**: `CheckboxesField` routes through the shared
  `useCascadingOptions` hook — offered boxes narrow against the live record +
  `current_user`, the control gates behind a "select the parent first" hint
  while a `dependsOn` field is empty, and selections no longer offered are
  pruned per-element from the array. Adds `checkboxes-empty-*` /
  `checkboxes-option-*` testids.
- **`@object-ui/components`**: adds `checkboxes` to the form renderer's option
  field sets (`CASCADE_OPTION_FIELD_TYPES`, the cross-field cascade-clear
  effect, and the option pre-filter) so a `checkboxes` field is threaded
  `dependentValues` and gated identically to the other option widgets.
- Tests: `CheckboxesField.cascade.test.tsx` mirrors `MultiSelectField.cascade.test.tsx`.
