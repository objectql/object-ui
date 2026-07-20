---
"@object-ui/fields": minor
---

feat(fields): MultiSelectField per-option `visibleWhen` cascading + `dependsOn` gating (parity with single select, #2715)

The multi-value chip picker now implements the same ADR-0058 option
resolution as the single `SelectField`, closing the gap #2709 opened when a
`select` + `multiple` (and the `multiselect` type) started delegating to it.

- Extracted `useCascadingOptions` — the shared hook that resolves per-option
  `visibleWhen` filtering, `dependsOn` gating, and the live `dependentValues` +
  predicate-scope wiring — and routed both `SingleSelectField` and
  `MultiSelectField` through it (no duplicated resolver).
- `MultiSelectField` narrows its offered chips against the live record +
  `current_user`, gates behind a "select the parent first" hint while a
  `dependsOn` field is empty, and surfaces a legible empty state instead of a
  bare chip row.
- Cascade-clear: when the offered set changes (parent changed / predicate
  flipped) the widget prunes only the now-invalid selections, keeping the
  still-offered ones — the array analogue of the single select's clear.
- Tests: `MultiSelectField.cascade.test.tsx` mirrors `SelectField.cascade.test.tsx`
  (gating, per-element cascade clear, role/context gating).
