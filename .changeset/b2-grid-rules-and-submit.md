---
"@object-ui/core": patch
"@object-ui/fields": patch
"@object-ui/plugin-form": patch
"@object-ui/components": patch
---

B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

- **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
- **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale *required* error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).
