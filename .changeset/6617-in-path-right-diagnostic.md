---
'@object-ui/app-shell': patch
---

**metadata-admin predicates: `in` with a path on the right is now diagnosed in
dev mode instead of failing silently.** No verdict changes — this is a
diagnostic only.

The Setup/Studio predicate evaluator matches membership as `path in ['a','b']`:
the right-hand side must be a bracketed literal set. A membership test whose
right side is a **path** therefore never matched that branch at all. Carrying no
`==` / `!=` either, it fell through to the bare-truthy tail and the *whole* text
was evaluated as one operand:

- `'admin' in current_user.positions` — ADR-0068's own headline example, and the
  spelling `SelectOptionSchema`'s docblock names as the canonical use of the key
  — leads with a quote, so it came back verbatim as a non-empty string. A
  non-empty string is truthy, so the predicate read **TRUE for every user**,
  whatever `positions` held. The failure direction is **permissive**: an option,
  field or section gated to admins rendered for everyone.
- `data.roles in current_user.positions` — path-shaped, so the resolver walked
  off the draft mid-path and the predicate read **FALSE for every row** instead.

Either way the verdict had nothing to do with the membership that was written,
and nothing appeared in the console: objectstack#6936's unresolved-path warning
hangs on the path resolver, which quote-leading text never enters, and
objectui#4049's path-shaped-literal warning only matches text starting with an
identifier character.

Such a predicate now emits a warn-once dev-mode diagnostic naming the offending
text, the predicate that carried it, and the supported subset — and stating
plainly that **a path on the right of `in` cannot be written on this surface
today**, rather than implying that some other punctuation would work. The
detection reuses the evaluator's existing quote-aware scan, so a predicate that
is itself a quoted literal containing the word (`'plug in adapter'` — correct
code) is *not* accused.

Nothing is resolved that was not resolved before and no operand handling is
added; every predicate that evaluates today reaches exactly the same answer,
pinned before and after. The semantic fix belongs to publish-time validation of
predicate expressions (objectstack#7010) and to the real CEL runtime — this
evaluator is an interim stand-in for `@objectstack/formula` and this diagnostic
retires with it at ROADMAP M9, the same as objectui#4049's and objectui#4266's.

objectui#6617.
