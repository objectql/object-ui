---
'@object-ui/console': patch
---

The console's standalone form renderer now evaluates conditional field visibility.

`apps/console/src/components/FormPage.tsx` is a **second, independent form renderer**
— its own `buildSections`, its own JSX — and it serves both the public
`/f/:slug` route and the internal `/forms/:name` route. It read neither spelling of
the FormView field visibility predicate: a repo-wide grep for a `visibleWhen` /
`visibleOn` *read* inside that file returned zero. So a field an author conditioned on
`record.priority == 'urgent'` — legal, spec-strict metadata that `@objectstack/spec`
normalises to `visibleWhen` (ADR-0089), and that the metadata-admin designer both
authors and honours — rendered unconditionally on both routes. Fail-open and silent:
the author saw the field always, with no diagnostic.

objectui#2212 recorded this exact symptom and PR #2214 fixed it — in a **different
chain**: `ModalForm` → `resolveFormViewLayout` → `@object-ui/plugin-form`
`sectionFields.ts` → `@object-ui/components` `renderers/form/form.tsx`. `FormPage.tsx`
is on that chain at no point, and #2212's regression pin lives with the chain it fixed,
so nothing in the suite could see this copy. One contract, two implementations, each
only ever checked against itself.

The wiring is **#2212's ruling applied verbatim** rather than a second predicate
semantics invented for this renderer, because two form renderers disagreeing about what
`visibleWhen` *means* would be a worse defect than one renderer ignoring it. The
predicate goes through the canonical engine — `evalFieldPredicate` (`@object-ui/core`,
`evaluator/fieldRules.ts`) — so the accepted wire shapes (bare CEL string and
`{ dialect, source }`), the bound scope (`record.*` = the live input values, `previous.*`
= the stored record an edit form started from), and the fail-open-but-loud behaviour on
an unevaluable predicate are the shared ones by construction. Resolution is
canonical-first, `visibleWhen ?? visibleOn`, matching both sibling readers:
`sectionFields.ts` and app-shell's `readVisibility`.

Two things deliberately did **not** change. A field hidden by its predicate still
submits its value — conditional visibility is a rendering rule in both renderers, and
making it a submit-payload rule would be a new contract decided once for both, not
invented in the second one. And `FormPage` is **not** folded onto the plugin-form chain:
the second-renderer question is real, but it belongs with the #5596 convergence track,
not with a predicate that is dead today.

`FormPage.visibleWhen.test.tsx` is the regression pin, and it lives next to *this*
renderer on purpose — a pin that cannot see the second copy is how the first gap
survived. With the fix reverted and the pin in place the suite reports
`11 failed | 1 passed (12)`; the one green is the control that has to be green (a field
with no predicate still renders), without which every "the field is absent" assertion
would be equally satisfied by a renderer that draws nothing at all.
