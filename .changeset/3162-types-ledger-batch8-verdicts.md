---
---

Closes the last batch of the `@objectstack/spec` any-erasure ledger (objectstack#4115 batch
8/8) with zero re-exports, because measurement says none of the four symbols is burnable.

The batch — `JoinNode`, `NavigationItem`, `NavigationItemSchema`, `JoinedReportBlock` — was
filed as "blocked on objectstack#4171; burn down when the upstream `any` erasure lifts".
That issue closed completed on 2026-07-30, which is the card's own start signal. Re-measuring
each symbol in the BUILT dist at `@objectstack/spec` 17.2.0 (source and issue state are both
insufficient — dist erasure is invisible from either) found three different reasons why
binding is still wrong, none of them the reason the ledger recorded:

- `JoinNode` — the spec no longer exports the symbol at all; spec 17.0.0 retired the
  `query.joins` cluster. Nothing upstream to bind to.
- `NavigationItem` — upstream is precise now, so "no longer `any`" is settled; the three
  semantic blockers that actually prevent binding are untouched by it.
- `NavigationItemSchema` — upstream is precise now too, and that is exactly what makes the
  burn-down dangerous: the live blocker is runtime shape, invisible to every type-level
  probe. Referencing the spec's schema would make the published `objectui validate` reject
  navigation metadata this renderer accepts today.
- `JoinedReportBlock` — still erased, to `unknown`, by a cause objectstack#4171 never
  covered (a bare `z.ZodTypeAny`, not recursion).

So the remaining debt is converted from a card pointing at an upstream issue into pins that
each name their own release condition, and the guard's machine-readable ledger
(`check:spec-symbols`) goes from "3 untriaged collisions" to zero, with the three symbols
recorded as declared dialects carrying their measured reasons.

Two stale justifications were corrected in passing, both the same defect class this ledger
exists to catch — a comment asserting an upstream type "erases to `any`" when it no longer
does. Left alone, the next triage checks the claim, finds it false, and lands the regression.
No published behaviour changes; no runtime code was touched.
