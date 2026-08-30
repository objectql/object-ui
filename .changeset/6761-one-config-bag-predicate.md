---
---

Internal refactor only; no published behaviour changes. "Is this value a real config bag
(an object, not an array, not null)?" was asked in `packages/react` in six places in four
spellings — `SchemaRenderer`'s module-private `isConfigBag`, its `winningVisibilityKey`
inline, `utils/propsBagDiagnostic.ts`'s private twin, and TWO in
`utils/unevaluatedExpression.ts` (`scanBag`'s negated early return and the `hoisted`
dedupe read). All six now read one exported predicate, `utils/configBag.ts`
(objectui#6761).

They agreed, which was never the cost: a copy that drifts produces no error, only a
different answer on one channel — the failure mode `hasDeclaredPredicate` was created to
end for "is a gate DECLARED?" (objectui#3850). So the convergence ships with a pin,
`utils/configBag.pin.test.ts`, that fails when a seventh spelling appears anywhere in
`packages/react/src`. The two sites that ask the same SHAPE question about a data ROW
(`SchemaRenderer`'s `boundRecord`, `usePredicateRecordContext`) are deliberately NOT
merged and are named in the pin's allowlist with that reason: their "no row → bind
NOTHING" rule is a different ruling, and it must not move if "config bag" ever narrows.

Each of the six sites was ablated individually to bare truthiness and measured, rather
than assumed equivalent because the lines look alike.
