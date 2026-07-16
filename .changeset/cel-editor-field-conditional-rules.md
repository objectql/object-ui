---
'@object-ui/app-shell': minor
---

Studio object designer: the field inspector's conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`) are now edited with a proper CEL editor — live syntax/semantic validation and autocomplete (object fields after `record.` / `previous.`, the runtime-bound roots `record`/`previous`/`parent`, and the CEL stdlib), backed by the same `@objectstack/formula` validators the server uses. Bare field references are flagged with the exact `record.<field>` fix, the deprecated `conditionalRequired` alias migrates to `requiredWhen` on first edit, and draft validation reports an invalid predicate on any field under its `fields.<field>.<rule>` path before save. (#1582)
