---
"@object-ui/core": minor
---

feat(core): build-time guardrail for cascading select option predicates (#1583)

`@object-ui/core` now exports `lintOptionPredicates(fields)` — a static,
conservative validator for the per-option `visibleWhen` CEL predicates that
drive cascading / role-gated `select` options (#2284). An option predicate fails
*closed* — a wrong one makes its option silently never appear — so this catches
the class of bug runtime fail-open can't surface:

- `syntax` — invalid CEL, delegated to `@objectstack/formula`'s
  `validateExpression` (no schema hint, so a legitimate `current_user.roles`
  reference is never mistaken for an error);
- `unknown-field` — a `record.<name>` reference to a field the form never
  declares (a sibling typo);
- `option-literal-not-in-domain` — a literal compared against an *enum* sibling
  that is outside its declared option values, e.g. `record.country == 'chna'`
  when `country` is `cn`/`us` (the AI-authoring typo #2284 called out).

It only flags what it can statically prove — non-`record.` roots
(`current_user.*`), open-domain fields, and unrecognized shapes are left alone,
so there are no false positives. The schema catalog runs it over every shipped
example. Design recorded in ADR-0058.
