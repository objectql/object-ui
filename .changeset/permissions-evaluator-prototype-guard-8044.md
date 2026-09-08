---
'@object-ui/permissions': minor
---

`evaluateCondition` now **denies** a record when a row-level condition names something that is not the record's own data. It used to **admit** it — silently, on a permission boundary.

The guard it replaces refused three field names by list (`__proto__`, `constructor`, `prototype`) and read every other name with `hasOwnProperty`. `hasOwnProperty` collapses *inherited* into *absent*, and on a negative operator absent ADMITS, so every prototype member outside those three spellings passed every record through the rule that existed to hide it. Measured against the record `{ id: 1, tenant: 'acme' }`: `{ field: 'toString', operator: 'neq' }` returned `true`, as did `valueOf`, `hasOwnProperty` and `isPrototypeOf`, on both `neq` and `not_in`. A longer list does not close this — a list enumerates spellings, and `Object.prototype` has more of them than any list will hold.

**The second reach path needs no crafted condition.** The same read widened for records whose value is *inherited*: on `Object.create({ tenant: 'acme' })`, `{ field: 'tenant', operator: 'neq', value: 'acme' }` returned `true` — the record's tenant *is* `acme`, and the rule that hides `acme` rows admitted it. A class instance with a prototype accessor is enough to reach it.

**The field a condition names is now read in three cases instead of two.** A name in the refused list denies. An own member is read as before, including a record whose own key happens to be spelled `toString`. A name that is not an own member but still resolves on the record's prototype chain denies, because the value exists but is not this record's data. A name that resolves nowhere is a genuinely absent field and still reads as `undefined`, so the ordinary "this record has no `status`" rules keep every verdict they have always had.

That last case is load-bearing rather than a detail: refusing *every* non-own read would deny records this evaluator should admit, which on a permission boundary is a worse defect than the fail-open being closed.

This is the shape `readField` in `@object-ui/core`'s `DataScopeManager` adopted at objectui#7751, ported back to the evaluator that was #7751's reference — and which, it turned out, carried the defect it was being used as the standard for. The two evaluators now give the same answer for a prototype-named field and for an inherited value; operator SPELLING (`neq` / `not_in` here, `ne` / `nin` there) is untouched and remains objectui#7750's question.

**The narrowing, named plainly for anyone upgrading with conditions already stored.** A condition loses records in exactly two shapes: one that names a prototype member (`toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, …), and one that reads a field records inherit from a shared prototype rather than own — for the second, the fix is to give the record the field as its own data. Measured over a 3696-case differential matrix of field names, record shapes, operators and values, replaying every case through both the previous release's read and this one: **234 verdicts narrowed, zero widened**, and zero change across the 924 genuinely-absent-field cases.

Graded `minor` because a release reader can observe the narrowing on stored conditions; no declared type changed and the set of inputs the evaluator accepts has not widened.
