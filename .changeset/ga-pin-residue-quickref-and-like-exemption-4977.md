---
---

Clears the two GA-pin residues that were red on `main` itself, so every open PR stopped
inheriting a red `Test (shard 3/4)` (objectui#4977). No published behaviour changes: the
only files touched are a root doc and a test file.

`QUICK_REFERENCE.md`'s "Current Release" block still quoted `@objectstack/spec` and
`@objectstack/client` as `^17.0.0-rc.6` after the manifests moved to the `^17.0.0` GA
range. Both rows now state the range their named anchor declares — the doc followed the
manifest, the pin that derives the expectation was not loosened.

The `@objectstack/spec` GA `FieldOperatorsSchema` added `$like` and `$ilike`, which no
builder operator authors, so the #2942 reachability sweep in
`packages/fields/src/widgets/__tests__/FilterConditionField.operators.test.ts` reported
them by design. They are excluded through that gate's own citation mechanism as
**undecided — see objectui#4911** (the open decision box on whether the visual filter
builder should offer raw pattern matching), with the harvest condition written on the
entry: a ruling on #4911 must either delete the members and add the operators, or restate
the paragraph as a decision carrying its reopen condition. No operator was implemented and
no other gate logic moved — the product ruling stays with the maintainer.
