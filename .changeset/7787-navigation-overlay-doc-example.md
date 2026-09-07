---
---

Point `navigation-overlay.tsx`'s file-header `@example` at the shared record-source
reader — `resolveRecordSourceObjectName(schema, dataConfig)` from `@object-ui/core` —
instead of the `objectName: schema.objectName` spelling PR #7648 retired from
`useNavigationOverlay`'s own doc block (objectui#7787). That fix never reached this
file: different file, different package, a block documenting a different symbol. The
example follows the hook's doc block rather than restating its rule, because a ruling
written out twice is a ruling one of whose copies rots — which is what happened here.

`KNOWN_HAND_SPELLINGS` in `scripts/check-doc-example-shared-reader.mjs` carried this
file as its one row and is drained in the same change, as that ledger requires: a row
naming a defect the gate no longer finds fails the gate rather than sitting there as a
waiver for nothing.

Doc comment and tooling only; no published behaviour changes and no package is
released by this change.
