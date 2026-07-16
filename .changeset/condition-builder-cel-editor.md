---
"@object-ui/app-shell": minor
---

Studio: CEL lint + field autocomplete for condition predicates (#1582).

`ConditionBuilder`'s raw-expression escape hatch — a bare `<textarea>` — is
replaced by `CelPredicateField`, so every surface that authors a condition
through it gains inline syntax/semantic validation and field-name autocomplete
on the canonical `@objectstack/formula` engine:

- field-level `visibleWhen` / `readonlyWhen` / `requiredWhen` (SchemaForm's
  `condition` widget auto-maps `/When$/` properties),
- action `visible` / `disabled` (ActionDefaultInspector),
- every other `condition`-widget property (`visibleOn`, `predicate`, …).

The no-code [subject][op][value] builder path is unchanged; only the "Expression"
mode is upgraded. An invalid predicate now surfaces a readable inline error
instead of failing silently at runtime. English + Chinese labels.

This completes the objectui side of #1582 — the CEL assists it asked for now
cover the field `*When` inputs (and, since the previous change, view
`conditionalFormatting` conditions).
