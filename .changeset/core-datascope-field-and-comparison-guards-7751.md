---
'@object-ui/core': minor
---

`DataScopeManager` now **denies** a row when a scope rule names something that is not the record's own data, and when an ordered comparison would only succeed by coercing one of its two sides. It used to **admit** those rows.

Two fail-opens on a row-level permission boundary, both measured against the previous release's source, both the same silent direction as objectui#7378 — a result set that is too large, with no error and no console line, which looks exactly like a correctly configured permissive scope.

**The field a rule names is now read as an own member of the record, or not read at all.** `{ field: 'constructor', operator: 'ne', value: anything }` returned the ENTIRE dataset: the name resolved on the prototype chain, `Function !== 'x'` is true, and every row passed the rule that existed to hide it. The read now has three cases instead of one. A name in the refused list (`__proto__`, `constructor`, `prototype`) denies. An own member is read as before. A name that is not an own member but still resolves on the record's prototype chain — `toString`, `valueOf`, `hasOwnProperty`, or a field inherited from an `Object.create` parent — denies, because the value exists but is not this record's data. A name that resolves nowhere is a genuinely absent field and still reads as `undefined`, so the ordinary "this row has no `status`" rules keep every verdict they have always had.

That third case is deliberately stricter than `evaluateCondition` in `@object-ui/permissions`, which this card was filed to converge with. Reading with `hasOwnProperty` alone — the sibling's shape — collapses "inherited" into "absent", and absent ADMITS on a negative operator, so the sibling still returns `true` for `{ field: 'toString', operator: 'neq' }` on every record (filed as objectui#8044). Converging on the sibling's exact lines would have closed three spellings and left the class open, and would itself have widened one case: an inherited field value flips from denied to admitted under `ne`. Distinguishing inherited from absent closes the class and keeps the change a narrowing everywhere.

**Ordered comparisons (`gt` / `gte` / `lt` / `lte`) now require both sides to be the same comparable kind.** `{ field: 'age', operator: 'gte', value: 0 }` admitted records whose `age` was `null`, `'10'`, `true`, `false`, `''` or `[]` — every one of them through a coercion to a number that the rule's author never wrote. Both sides must now be numbers, or both strings, or both `Date`s.

Same KIND, not "both numbers". The sibling requires `typeof === 'number'` on both sides; copying that predicate would have denied every row for `{ field: 'created', operator: 'gte', value: '2023-01-01' }`, since ISO date strings, plain string ranges and `Date` objects all order correctly on this evaluator today and none of those comparisons coerces anything. The hazard is cross-kind comparison, so cross-kind is what is refused.

**`contains` now requires its rule value to be a string** rather than calling `String()` on it, so `{ operator: 'contains', value: 1 }` no longer matches the record value `'10'`. Same unwritten coercion as the ordered arms; the sibling already refused it.

**The narrowing, named plainly for anyone upgrading with rules already stored.** A legitimate rule loses rows in exactly three shapes. A numeric rule (`age gte 18`) over a dataset where numbers arrive as strings — from JSON, a CSV import, an unparsed form field — stops matching those records; `'20'` was admitted by coercion and is now denied, and the fix is to parse the field at the producer rather than to widen the rule. A rule reading a field that records inherit from a shared prototype rather than own stops matching. And a `contains` rule written with a non-string value stops matching. Measured over a 2772-case differential matrix of value kinds, operators and record shapes: 352 verdicts narrowed, **zero widened**, and zero change to the genuinely-absent-field family.

Operator SPELLING is untouched, deliberately: `ne` / `nin` here versus `neq` / `not_in` in the sibling, and the sibling's `is_null` / `is_not_null` which this evaluator does not implement, remain exactly as they were. That divergence is objectui#7750's question.

Graded `minor` because a release reader can observe the narrowing on stored data; no declared type changed and the set of inputs the evaluator accepts has not widened.
