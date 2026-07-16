---
"@object-ui/core": minor
"@object-ui/react": minor
"@object-ui/components": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-kanban": minor
"@object-ui/plugin-view": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-designer": minor
---

Unify the list-view conditional tier onto the canonical CEL engine (#1584).

Conditional formatting (list / grid / kanban) and row-action `visible` /
`disabled` predicates are now evaluated by `@objectstack/formula`'s
`ExpressionEngine` — the same engine the server uses — instead of the legacy
JS-dialect `ExpressionEvaluator`, matching how `@objectstack/spec` already types
these surfaces (`ExpressionInputSchema` / CEL). The whole platform now speaks one
expression dialect (framework ADR-0058).

- `@object-ui/core`: new `evalRowPredicate` + `resolveConditionalFormatting`
  helpers (next to `evalFieldPredicate`). One implementation of all three
  formatting rule shapes; dialect routing (a `{ dialect: 'cel' }` envelope is
  always CEL; a bare string is CEL unless it carries legacy-only syntax
  (`${…}` / `===` / `?.` / `.includes()`), which routes to the old engine with a
  one-time deprecation warning); the native `{ field, operator, value }` form is
  translated to CEL.
- `@object-ui/react`: new `useRowPredicate` hook (canonical CEL, ambient
  predicate scope merged).
- Consumers converged: `ListView.evaluateConditionalFormatting` (thin wrapper,
  export kept), `ObjectGrid` row styling (inline copy removed), kanban card
  styles, and the grid / data-table row-action menus. `plugin-view`'s kanban
  branch now forwards top-level `conditionalFormatting` (previously dropped).
- Row-action `visible` fails **closed** (broken predicate → hidden + warn);
  `disabled` fails soft. The CEL `in` operator (and list membership) now work in
  row predicates — the legacy engine could not parse them.
- The legacy `FormField.condition: { field, equals/notEquals/in }` is retired to
  a CEL translation (back-compat preserved); `FieldDesigner` migrated to
  `visibleWhen`.

Fully back-compat: existing conditional-formatting rules, row-action predicates,
and form `condition` metadata keep working (translated / routed as needed).
