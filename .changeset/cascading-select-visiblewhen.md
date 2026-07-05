---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/components': minor
'@object-ui/fields': minor
---

Cascading & role-gated `select` options (#2284).

`select` options now accept a per-option `visibleWhen` CEL predicate — the option
is offered only when it evaluates TRUE against the live record **plus
`current_user`** (same engine/env as a field-level `visibleWhen`). Combined with a
field-level `dependsOn`, this drives dependent selects (country → province → city)
and role/context gating with no bespoke matrix — the same primitives dependent
lookups (#2215) already use.

- `@object-ui/core` exposes `resolveVisibleOptions` / `isOptionGroupGated` /
  `resolveDependsOnFields` / `isValueStillOffered` (evaluator), reusing the
  canonical `evalFieldPredicate`.
- The form renderer narrows a dependent select's option list, gates the control
  with a "Select {parent} first" hint while a `dependsOn` field is empty, and
  clears a now-invalid value when the parent changes.
- The standalone `SelectField` widget applies the same resolution via
  `dependentValues` + the global predicate scope.

Client-side hiding is UX, not authorization: gate authorization-sensitive option
values on the server too. Aligns with `@objectstack/spec` `SelectOption.visibleWhen`.
