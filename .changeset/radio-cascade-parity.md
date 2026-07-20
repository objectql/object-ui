---
"@object-ui/core": minor
"@object-ui/fields": minor
"@object-ui/components": patch
---

feat(fields): RadioField per-option `visibleWhen` cascading + `dependsOn` gating; single-source the option resolver

Brings `RadioField` to parity with `SelectField` / `MultiSelectField` for ADR-0058
cascading & role-gated options, and collapses the three copies of the
gate-then-filter logic onto one shared resolver.

- **`@object-ui/core`**: new pure `resolveCascadingOptions(rawOptions, record, dependsOn, scope)`
  → `{ options, gated, dependsOnFields }` — the single source of truth for
  `dependsOn` gating + per-option `visibleWhen` filtering.
- **`@object-ui/fields`**: `RadioField` now narrows its offered radios against
  the live record + `current_user`, gates behind a "select the parent first"
  hint while a `dependsOn` field is empty, and clears a value no longer offered
  (scalar cascade clear). The `useCascadingOptions` hook is refactored to a thin
  React wrapper over `resolveCascadingOptions`.
- **`@object-ui/components`**: the form renderer's inline option pre-filter and
  cross-field cascade-clear effect now call `resolveCascadingOptions` instead of
  re-deriving gating/filtering, so they can't drift from the widgets (no
  behavior change).
- Tests: `RadioField.cascade.test.tsx` mirrors the select cascade tests; core
  gains `resolveCascadingOptions` unit coverage.
