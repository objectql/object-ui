---
"@object-ui/plugin-view": patch
---

fix(view): the spec→FilterBuilder map follows the four operators #2942 added

`CANONICAL_TO_BUILDER` mapped `starts_with`, `ends_with`, `is_null` and
`is_not_null` to `null`, with a comment asserting the FilterBuilder had no such
operator. #2942 gave it `startsWith`, `endsWith`, `isNull` and `isNotNull` —
and this table did not follow, so a stored view carrying any of the four still
reached the builder as a raw spelling it could by then have rendered, and the
comment claiming otherwise was simply false.

All four now map. `is_null`/`is_not_null` go to `isNull`/`isNotNull` and **not**
to `isEmpty`/`isNotEmpty`: the builder draws both pairs, and folding the NULL
predicate onto the empty-string one would silently rewrite the author's operator
the next time the view was saved.

**The guard could not have caught this, and now can.** The parity test asserted
the unmapped set equalled a hand-kept list of gaps — which stays true when the
*builder* gains an operator, because neither side of that comparison moves. The
new assertion is derived instead: `starts_with` and `startsWith` fold to the same
key, so an unmapped canonical operator whose folded name matches a folded builder
id is an omission by definition. Verified by reverting the four mappings, which
reproduces the drift as four named failures.

The unmapped set is now empty — all 19 canonical `VIEW_FILTER_OPERATORS` members
translate.

Refs #2945, #2942, #2989
