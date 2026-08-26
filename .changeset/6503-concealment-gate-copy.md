---
'@object-ui/react': minor
---

The unresolvable-predicate diagnostic tells `hidden` / `hiddenOn` authors what actually
happened to their node (objectui#6503). Those two legs are the only ones in
`SchemaRenderer`'s visibility chain whose verdict is NOT negated: `evaluateCondition`
answers an unevaluable predicate with `true` on every path, the four negated legs turn that
into SHOWN, and these two return it as-is, so the same `true` sets `_hidden` and the
component returns `null`. Both were handed the consequence paragraph written for the negated
legs — "the gate did NOT bite - a predicate that cannot be evaluated reads on screen exactly
like one that said yes" — which is the opposite of what an author whose block VANISHED is
looking at. That line exists to name their predicate, and instead it sent them to hunt a
rendering bug that does not exist.

The two legs now print their own paragraph: the safe default is the one that BITES here, the
node was REMOVED and is not on the page at all, an absent node is indistinguishable from
metadata that meant to hide it, and nothing is wrong with the renderer.

Copy only — no verdict moved. The node still vanishes, which is the shipped fail-soft the
neighbouring family (objectui#3862 / #3955 / #6443 / #6487 / #6445) preserved deliberately,
and every case in the new suite pins the verdict beside the sentence.

`PredicateGateKind` — re-exported from `@object-ui/react`'s entry — gains a third member,
`'concealment'`, joining `'visibility'` and `'enablement'`. The opening line is deliberately
UNCHANGED (`UNRESOLVABLE_VISIBILITY_PREFIX`): these are visibility predicates, and an app or
a test filtering the console by that constant must go on catching them. Consumers that
switch EXHAUSTIVELY over the union, or key a `Record` by it, gain a third case to answer;
no runtime signature moved and every value accepted before still is.
