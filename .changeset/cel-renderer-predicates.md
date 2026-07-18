---
"@object-ui/core": minor
"@object-ui/react": minor
---

feat(evaluator): route `{ dialect: 'cel' }` component/action predicates to the canonical CEL engine (#2661)

Component and action `visible` / `disabled` / `hidden` predicates were evaluated
by the home-grown JS `ExpressionEvaluator`, while field rules
(`visibleWhen`/`readonlyWhen`/`requiredWhen`, via `fieldRules.ts`) and row/list
conditionals (via `evalRowPredicate`) already delegate to the canonical
`@objectstack/formula` engine. That split meant a `{ dialect: 'cel' }` predicate
in a renderer/action surface was executed as **JavaScript** — CEL-only forms
(`x in list`, `has()`, typed `==`, the `today()`/`daysFromNow()` catalog) behaved
differently from, or faulted against, the server's enforcement.

This converges the remaining tier onto the same engine:

- **`@object-ui/core`** — `ExpressionEvaluator.evaluateCondition` now detects a
  `{ dialect: 'cel', source }` envelope and evaluates it on `@objectstack/formula`
  (via `evalFieldPredicate`), binding the `record` namespace plus the whole
  context bag as top-level scope (`record.*`, `features.*`, `user.*`, `app.*`).
  Fail-soft to visible/enabled to match the legacy default; `throwOnError`
  callers still fail closed on a *faulting* predicate (a genuine `false` never
  throws). This fixes every `SchemaRenderer` visibility/disabled read at once.
- **`@object-ui/react`** — `toPredicateInput` preserves a CEL envelope instead of
  collapsing it to a `${source}` string, and `useCondition` accepts and forwards
  the envelope (keyed on a stable `(dialect, source)` so it doesn't re-evaluate
  each render). Action buttons (`action-icon`/`group`/`bar`/`button`) therefore
  evaluate CEL `visible`/`enabled`/`disabled` on the canonical engine.

**Back-compat:** bare strings and `${…}` templates stay on the legacy JS path
(deprecation window); only an explicit `{ dialect: 'cel' }` envelope is rerouted.
`{ dialect: 'template' }` is unaffected.

Together with the `^15.1.1` alignment (#2662), a renderer CEL predicate now
reaches the identical verdict as the server — including the framework's
`dateField == today()` equality fix (objectstack-ai/framework#3205) once it
lands in a published 15.x. The broader home-grown-vs-canonical divergence
motivation is #2661.
