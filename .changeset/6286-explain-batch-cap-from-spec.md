---
'@object-ui/plugin-grid': patch
---

The batch-explain cap the row-verdict hook paginates under is now imported from
`@objectstack/spec/security` instead of re-declared locally (objectui#6286).
`useRecordCrudVerdicts` carried `const EXPLAIN_BATCH_MAX_RECORD_IDS = 200`, a hand copy of
a SERVER contract constant, under a doc comment that named its own expiry condition: the
pinned `@objectstack/spec@17.0.0-rc.6` predated the batch form, and the pin bump would
supersede the declaration. It has.

**No value changes and no behaviour changes.** The spec exports `200`, which is what the
local copy said, verified by resolving the installed package and reading the export — both
statically (`dist/security/index.d.mts`) and at runtime through the same specifier the
source now uses. What changes is reference identity: if the server relaxes or tightens the
cap and the spec follows, the client follows too, instead of paginating at the old boundary
with no signal anywhere. The cap's whole point is that an over-cap request is refused with
`400 VALIDATION_FAILED` rather than truncated, so a client that silently disagrees with it
is exactly the drift `scripts/check-spec-symbol-derivation.mjs` argues about — and could
not catch here, because both of its scanners skip non-exported declarations and this const
was module-local (objectui#5899).

The declared floor already carries the symbol, so no range moves: `@objectstack/spec@17.0.0`
— the minimum `^17.0.0` admits — exports `EXPLAIN_BATCH_MAX_RECORD_IDS = 200` from
`./security`. Measured against the published tarballs of `17.0.0-rc.6`, `17.0.0`, `17.1.0`
and `17.2.0`: only the rc lacks it. The declaration was therefore expired one release
earlier than the card that found it assumed.

The half of the comment that explains *why* the cap exists and what the server does with an
over-cap request is kept and now sits on the import; only the half explaining why it was
declared LOCALLY is gone, since that is the part that stopped being true.

Covered by a new reference-identity test rather than a value assertion. Every assertion on
`200` passes on both sides of this change — a ghost — so
`useRecordCrudVerdicts.batchCap.test.tsx` stands the spec module in at a cap no hand copy
could produce and asserts the request chunking follows it, with a control case proving the
stand-in installed and differs from the shipped value. The pre-existing cap assertion in
`rowRecordCrudVerdict.test.tsx` now derives its fixture and its bound from the same export
instead of re-typing `200`, which removes the last hand copy on this surface without
pretending to be a two-world test.
