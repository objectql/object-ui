---
'@object-ui/components': minor
---

**Behaviour change.** Form section and field `visibleWhen` predicates that silently failed
OPEN now actually evaluate — and a rule that resolves FALSE now hides the field
(objectui#6010).

`current_user` was bound on two of the three `visibleWhen` surfaces and not the third. A
page component or app/nav gate got it (`ExpressionProvider` → `SchemaRenderer`), and a
per-option gate got it (`resolveCascadingOptions(…, predicateScope)`), but every
`resolveFieldRuleState` call in the form renderer passed `undefined` for the scope
argument, so a form SECTION or FIELD predicate saw `record` and `previous` and nothing
else. `'sales_manager' in current_user.positions` therefore named an **unbound root**
there, and the visibility fallback is fail-open — so the gate did not hide the field from
the people it named, it **showed the field to everyone**, with no signal beyond one
deduped `console.warn`.

**What changes for you, in the direction that matters:** if you authored a form-field or
form-section `visibleWhen` naming `current_user`, saw the field render, and concluded the
rule was permissive — it was not permissive, it was broken, and it is now enforced. That
same field will now **hide** for every user the predicate resolves FALSE for. Audit any
`visibleWhen` on a form field or section that references `current_user` / `user` /
`ctx.user` / `os.user` before upgrading; a predicate that was quietly inert becomes live.

Two things deliberately do **not** change:

- **A genuinely unbound root still fails open.** A predicate the engine cannot evaluate at
  all still logs one warning and leaves the element visible. Only *evaluated-and-false*
  hides. `visibleWhen` remains presentation, not access control — use field-level security
  or RLS to stop someone reading something.
- **The deprecated `visibleOn` alias** on a form field now binds the same scope, because
  ADR-0089 D2 folds it into `visibleWhen` at parse; binding one scope for the canonical
  spelling and another for its alias would have reproduced the same defect one spelling
  over. The synthesised legacy `condition: { field, equals }` predicate is unaffected — it
  is generated from a structured object and can only ever name `record.<field>`.

This restores the contract both ADRs already declared: ADR-0068 D1 — *"a predicate authored
against any one form evaluates identically"* — and ADR-0089 D1 — *"runtime record surfaces
bind `record` + `current_user`"*. All five surfaces are now pinned against one authored
predicate text in
`packages/components/src/renderers/form/__tests__/predicate-scope-parity-6010.test.tsx`,
so the next divergence is loud instead of silent.
